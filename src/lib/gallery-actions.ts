"use server";

import path from "path";

import { NOT_REVOKED, prisma } from "./prisma";
import cloudinary from "./cloudinary";
import { enforceRateLimit } from "./rate-limit";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { publicAuthOptions } from "./auth";
import { can, requireAnyUser, requirePermission, requireUser } from "./guards";
import { assertFeature } from "./feature-gate";
import { CONTRIBUTION_FOLDER_PREFIX, resolveUploadFolder } from "./rbac/upload-folder";
import { validateUpload } from "./upload-validation";
import { sendMail, templates } from "./email";
import { getConfig } from "./config-utils";
import { adminEmail } from "./admin-contact";

export async function uploadImageAction(formData: FormData, folder?: string) {
  await requireAnyUser();

  // Publishing rights, not staff status — see resolveUploadFolder.
  const target = resolveUploadFolder({
    mayPublish: await can("gallery.media.upload"),
    requested: folder,
  });

  try {
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided");

    const { buffer } = await validateUpload(file, "media");

    return new Promise((resolve) => {
      cloudinary.uploader.upload_stream(
        {
          folder: target,
          resource_type: "auto",
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            resolve({ error: "Cloudinary upload failed" });
          } else {
            resolve({
              url: result?.secure_url,
              publicId: result?.public_id,
              width: result?.width,
              height: result?.height,
            });
          }
        }
      ).end(buffer);
    });
  } catch (err: any) {
    console.error("Upload action error:", err);
    return { error: err.message || "Upload failed" };
  }
}

/**
 * Remove an asset from Cloudinary.
 *
 * `resource_type` defaults to "image" in the Cloudinary SDK, which is why
 * `type` has to be threaded through from the caller rather than omitted:
 * `destroy` on a video publicId without `resource_type: "video"` looks in
 * the wrong bucket, finds nothing, and resolves with `{ result: "not
 * found" }` rather than throwing — so every video-typed GalleryMedia /
 * MediaContribution row deleted before this parameter existed had its
 * database row removed while the actual Cloudinary asset silently survived,
 * unreachable from the app but still billed.
 *
 * Not exported: every export of a `"use server"` file is a POST endpoint, and
 * the admin-guarded `deleteImageAction` wrapper that used to sit here had no
 * callers at all — the delete paths below use this directly. An endpoint
 * nobody calls is surface without purpose.
 */
async function deleteImage(publicId: string, type: "IMAGE" | "VIDEO" = "IMAGE") {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: type === "VIDEO" ? "video" : "image",
    });
    return { success: true };
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return { error: "Failed to delete image from storage" };
  }
}

/**
 * Public read for the home page strip: the most recent images across all
 * published albums, plus the totals worth quoting. Queried by albumId rather
 * than a relation filter to stay on the safe side of the Mongo connector.
 */
export async function getGalleryHighlights(limit = 5) {
  const albums = await prisma.galleryAlbum.findMany({
    where: { isPublished: true },
    select: { id: true, title: true },
  });

  if (albums.length === 0) {
    return { media: [], albumCount: 0, photoCount: 0 };
  }

  const albumIds = albums.map((a) => a.id);
  const titleById = new Map(albums.map((a) => [a.id, a.title]));

  const [media, photoCount] = await Promise.all([
    prisma.galleryMedia.findMany({
      where: { albumId: { in: albumIds }, type: "IMAGE" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, url: true, caption: true, albumId: true },
    }),
    prisma.galleryMedia.count({ where: { albumId: { in: albumIds } } }),
  ]);

  return {
    media: media.map((m) => ({
      id: m.id,
      url: m.url,
      caption: m.caption,
      albumId: m.albumId,
      albumTitle: titleById.get(m.albumId) ?? "",
    })),
    albumCount: albums.length,
    photoCount,
  };
}

/**
 * Rejects an eventId already claimed by another album, with a message the
 * admin can act on. The DB's partial unique index (see
 * prisma/fix-gallery-album-index.ts) is what actually guarantees this — this
 * check just turns the P2002 it would otherwise throw into something readable
 * before the write, since eventId is no longer @unique in schema.prisma.
 */
async function assertEventNotAlreadyLinked(eventId: string, excludeAlbumId?: string) {
  const existing = await prisma.galleryAlbum.findFirst({
    where: { eventId, ...(excludeAlbumId ? { id: { not: excludeAlbumId } } : {}) },
    select: { id: true, title: true },
  });
  if (existing) {
    throw new Error(`"${existing.title}" is already linked to this event. Unlink it first, or choose a different event.`);
  }
}

export async function createAlbum(data: {
  title: string;
  description?: string;
  category?: string;
  eventId?: string;
  coverImage?: string;
  isPublished?: boolean;
}) {
  await requirePermission("gallery.albums.edit");

  if (data.eventId) {
    await assertEventNotAlreadyLinked(data.eventId);
  }

  const album = await prisma.galleryAlbum.create({
    data: {
      ...data,
      isPublished: data.isPublished ?? true,
    },
  });
  revalidatePath("/admin/gallery");
  return { success: true, album };
}

export async function updateAlbum(id: string, data: {
  title?: string;
  description?: string;
  category?: string;
  eventId?: string;
  coverImage?: string;
  isPublished?: boolean;
}) {
  await requirePermission("gallery.albums.edit");

  if (data.eventId) {
    await assertEventNotAlreadyLinked(data.eventId, id);
  }

  const album = await prisma.galleryAlbum.update({
    where: { id },
    data,
  });
  revalidatePath("/admin/gallery");
  revalidatePath(`/admin/gallery/${id}`);
  return { success: true, album };
}

/**
 * Delete an album, its media rows, and the underlying Cloudinary assets.
 *
 * The Cloudinary half used to be a TODO ("for now, focus on DB"), which left
 * every photo live on the CDN at a guessable URL after the album was gone.
 * That is a running cost, but more importantly it means an erasure request
 * satisfied in the admin panel did not actually erase anything — the images
 * stayed retrievable by anyone holding the old link.
 *
 * Storage is deleted first: a failure there aborts before the database rows
 * are gone, so the assets are still discoverable and the delete can be
 * retried. The other order would strand them permanently.
 */
export async function deleteAlbum(id: string) {
  await requirePermission("gallery.albums.delete");

  const media = await prisma.galleryMedia.findMany({
    where: { albumId: id },
    select: { publicId: true, type: true },
  });

  const contributions = await prisma.mediaContribution.findMany({
    where: { albumId: id },
    select: { publicId: true, type: true },
  });

  const assets = [...media, ...contributions].filter(
    (m): m is { publicId: string; type: "IMAGE" | "VIDEO" } => !!m.publicId
  );

  const failures: string[] = [];
  for (const { publicId, type } of assets) {
    const result = await deleteImage(publicId, type);
    if ("error" in result) failures.push(publicId);
  }

  if (failures.length > 0) {
    console.error(
      `Album ${id}: ${failures.length}/${assets.length} assets could not be removed from Cloudinary.`,
      failures
    );
    return {
      error:
        `Could not delete ${failures.length} of ${assets.length} files from storage. ` +
        "The album was left intact — try again, or remove those files in Cloudinary first.",
    };
  }

  // Contributions have no cascade on the album relation, so they would
  // otherwise survive as rows pointing at an album that no longer exists.
  await prisma.mediaContribution.deleteMany({ where: { albumId: id } });

  await prisma.galleryAlbum.delete({
    where: { id },
  });

  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { success: true };
}

export async function addMediaToAlbum(albumId: string, mediaItems: { 
  url: string; 
  publicId: string; 
  type: "IMAGE" | "VIDEO"; 
  width?: number; 
  height?: number;
  caption?: string;
  faces?: {
    descriptor: number[];
    boundingBox: any;
  }[];
}[]) {
  await requirePermission("gallery.media.upload");

  try {
    for (const item of mediaItems) {
      const { faces, ...mediaData } = item;
      await prisma.galleryMedia.create({
        data: {
          albumId,
          ...mediaData,
          faces: {
            create: faces?.map(face => ({
              descriptor: face.descriptor,
              boundingBox: face.boundingBox,
            })),
          },
        },
      });
    }
    revalidatePath(`/admin/gallery/${albumId}`);
    revalidatePath("/gallery");
    return { success: true };
  } catch (err: any) {
    console.error("Add media error:", err);
    return { error: err.message || "Failed to save media to database" };
  }
}

export async function deleteMedia(id: string, publicId: string) {
  await requirePermission("gallery.media.delete");

  // Looked up rather than trusted from the caller, so this stays correct
  // even if a client passes stale/wrong data — see deleteImage's comment on
  // why the type has to be right.
  const media = await prisma.galleryMedia.findUnique({ where: { id }, select: { type: true } });

  await deleteImage(publicId, media?.type);
  await prisma.galleryMedia.delete({
    where: { id },
  });
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { success: true };
}

export async function bulkDeleteMedia(mediaItems: { id: string; publicId: string }[], albumId: string) {
  await requirePermission("gallery.media.delete");

  try {
    const types = await prisma.galleryMedia.findMany({
      where: { id: { in: mediaItems.map((m) => m.id) } },
      select: { id: true, type: true },
    });
    const typeById = new Map(types.map((t) => [t.id, t.type]));

    // 1. Delete from Cloudinary in parallel
    await Promise.all(mediaItems.map(item => deleteImage(item.publicId, typeById.get(item.id))));

    // 2. Delete from Database
    await prisma.galleryMedia.deleteMany({
      where: { id: { in: mediaItems.map(m => m.id) } },
    });

    revalidatePath(`/admin/gallery/${albumId}`);
    revalidatePath("/gallery");
    return { success: true };
  } catch (err: any) {
    console.error("Bulk delete error:", err);
    return { error: err.message || "Failed to delete multiple assets" };
  }
}

/** face-api.js descriptors are 128 floats; anything else is not one. */
const FACE_DESCRIPTOR_LENGTH = 128;

/**
 * Find gallery photos containing a given face.
 *
 * Special-category processing under Art. 9 GDPR, so both checks that the UI
 * already performs are repeated here. The client gated this behind a login and
 * `BiometricConsentGate`, but the action itself was reachable by anyone: submit
 * any descriptor and get back every photo that person appears in. A client-side
 * consent gate is a courtesy to the user, not a control.
 */
export async function searchMediaByFace(descriptor: number[], albumId?: string) {
  const user = await requireUser();

  if (!Array.isArray(descriptor) || descriptor.length !== FACE_DESCRIPTOR_LENGTH) {
    throw new Error("Invalid face descriptor");
  }
  if (descriptor.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    throw new Error("Invalid face descriptor");
  }

  // Art. 9(2)(a): explicit consent, checked server-side, and honouring a
  // withdrawal the moment it is made.
  const consent = await prisma.userConsent.findFirst({
    where: { userId: user.id, type: "BIOMETRIC", ...NOT_REVOKED },
    orderBy: { createdAt: "desc" },
  });
  if (!consent?.granted) {
    throw new Error("BIOMETRIC_CONSENT_REQUIRED");
  }

  enforceRateLimit(
    `face-search:${user.id}`,
    20,
    60_000,
    "Too many searches. Please wait a moment and try again."
  );

  // Scoped to published albums, and bounded: this used to load every
  // FaceDetection row in the database on each call.
  const detections = await prisma.faceDetection.findMany({
    where: albumId
      ? { media: { albumId, album: { isPublished: true } } }
      : { media: { album: { isPublished: true } } },
    select: { mediaId: true, descriptor: true },
    take: 20_000,
  });

  const threshold = 0.55;
  const mediaIds = Array.from(
    new Set(
      detections
        .filter((d) => euclideanDistance(descriptor, d.descriptor) < threshold)
        .map((d) => d.mediaId)
    )
  );

  if (mediaIds.length === 0) return [];

  return prisma.galleryMedia.findMany({
    where: { id: { in: mediaIds } },
  });
}

function euclideanDistance(arr1: number[], arr2: number[]) {
  if (arr1.length !== arr2.length) return 1;
  return Math.sqrt(
    arr1.reduce((sum, val, i) => sum + Math.pow(val - arr2[i], 2), 0)
  );
}

/**
 * Confirms a contribution's `publicId` is a real Cloudinary asset that was
 * actually uploaded through the member contribution path — not merely an id
 * the caller happens to know (a published gallery photo, the org's branding
 * logo, another member's profile picture). `submitMediaContribution` and
 * `submitBulkMediaContributions` are directly callable server actions that
 * used to accept `publicId`/`url` as free-form client input; a rejected
 * contribution deletes its `publicId` from Cloudinary
 * (`moderateContribution` → `deleteImage`), so trusting that value let any
 * signed-in member get an arbitrary asset destroyed by having it "declined".
 *
 * Two checks, both fail-closed:
 *  - The (normalized, traversal-collapsed) publicId must live under the
 *    shared contribution folder `resolveUploadFolder` sandboxes ordinary
 *    uploads into — assets outside it were never part of this flow.
 *  - It must not already back a live `GalleryMedia` row, so a member can't
 *    resubmit an already-published photo's publicId to get it deleted out
 *    from under its existing gallery entry.
 *
 * The client-submitted `url` is never trusted for what gets stored — the
 * canonical URL Cloudinary itself reports for the asset is used instead,
 * which also confirms the asset genuinely exists before it enters moderation.
 */
async function resolveContributionAsset(publicId: string, type: "IMAGE" | "VIDEO") {
  const normalized = path.posix.normalize(publicId);
  if (!normalized.startsWith(CONTRIBUTION_FOLDER_PREFIX)) {
    throw new Error("This file wasn't uploaded through the contribution flow.");
  }

  const alreadyLive = await prisma.galleryMedia.findUnique({
    where: { publicId: normalized },
    select: { id: true },
  });
  if (alreadyLive) {
    throw new Error("This photo has already been added to the gallery.");
  }

  try {
    const resource = await cloudinary.api.resource(normalized, {
      resource_type: type === "VIDEO" ? "video" : "image",
    });
    return { publicId: normalized, url: resource.secure_url as string };
  } catch {
    throw new Error("We couldn't find that upload. Please try uploading again.");
  }
}

export async function submitMediaContribution(data: {
  albumId: string;
  url: string;
  publicId: string;
  type: "IMAGE" | "VIDEO";
  width?: number;
  height?: number;
  caption?: string;
}, skipEmail?: boolean) {
  await assertFeature("enableGallery");

  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) throw new Error("Authentication required");

  const album = await prisma.galleryAlbum.findUnique({ where: { id: data.albumId } });
  if (!album) throw new Error("Album not found");

  const asset = await resolveContributionAsset(data.publicId, data.type);

  const contribution = await prisma.mediaContribution.create({
    data: {
      ...data,
      publicId: asset.publicId,
      url: asset.url,
      userId: session.user.id as string,
      status: "PENDING"
    }
  });

  // Notify Admin
  if (!skipEmail) {
    // Read out here: the closure loses TypeScript's narrowing on `session.user`.
    const uploaderName = session.user.name || "A member";
    await sendMail({
      template: "gallery.contribution-admin-notice",
      to: adminEmail(),
      entityId: contribution.id,
      build: (ctx) =>
        templates.gallery.contributionAdminNotice(ctx, {
          uploaderName,
          albumTitle: album.title,
        }),
    });
  }

  return { success: true, contribution };
}

export async function submitBulkMediaContributions(albumId: string, items: {
  url: string;
  publicId: string;
  type: "IMAGE" | "VIDEO";
  width?: number;
  height?: number;
  caption?: string;
}[]) {
  await assertFeature("enableGallery");

  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) throw new Error("Authentication required");

  const album = await prisma.galleryAlbum.findUnique({ where: { id: albumId } });
  if (!album) throw new Error("Album not found");

  // Every item is validated before any row is written — one bad publicId
  // fails the whole batch rather than silently dropping it, matching the
  // fail-closed behaviour of the single-item path.
  const resolvedItems = await Promise.all(
    items.map(async (item) => {
      const asset = await resolveContributionAsset(item.publicId, item.type);
      return { ...item, publicId: asset.publicId, url: asset.url };
    })
  );

  const userId = session.user.id;
  const contributions = await prisma.mediaContribution.createMany({
    data: resolvedItems.map(item => ({
      ...item,
      userId,
      albumId,
      status: "PENDING"
    }))
  });

  // Notify Admin ONCE
  const uploaderName = session.user.name || "A member";
  await sendMail({
    template: "gallery.contribution-admin-notice",
    to: adminEmail(),
    entityId: albumId,
    build: (ctx) =>
      templates.gallery.contributionAdminNotice(ctx, {
        uploaderName,
        albumTitle: album.title,
        count: items.length,
      }),
  });

  return { success: true, count: items.length };
}

export async function getPendingContributions() {
  await requirePermission("gallery.contributions.view");

  return await prisma.mediaContribution.findMany({
    where: { status: "PENDING" },
    include: {
      user: { select: { name: true, email: true } },
      album: { select: { title: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function moderateContribution(id: string, status: "APPROVED" | "REJECTED", reason?: string) {
  await requirePermission("gallery.contributions.moderate");

  const contribution = await prisma.mediaContribution.findUnique({
    where: { id },
    include: { user: true, album: true }
  });

  if (!contribution) throw new Error("Contribution not found");

  if (status === "APPROVED") {
    // 1. Add to GalleryMedia
    await prisma.galleryMedia.create({
      data: {
        albumId: contribution.albumId,
        url: contribution.url,
        publicId: contribution.publicId,
        type: contribution.type,
        width: contribution.width,
        height: contribution.height,
        caption: contribution.caption,
      }
    });

    // 2. Update Contribution Status
    await prisma.mediaContribution.update({
      where: { id },
      data: { status: "APPROVED" }
    });

    // 3. Notify User
    if (contribution.user.email) {
      await sendMail({
        template: "gallery.contribution-approved",
        to: contribution.user.email,
        entityId: contribution.id,
        build: (ctx) =>
          templates.gallery.contributionApproved(ctx, {
            name: contribution.user.name || "there",
            albumTitle: contribution.album.title,
          }),
      });
    }
  } else {
    // 1. Delete from Cloudinary
    await deleteImage(contribution.publicId, contribution.type);

    // 2. Update Contribution Status
    await prisma.mediaContribution.update({
      where: { id },
      data: { 
        status: "REJECTED",
        rejectionReason: reason
      }
    });

    // 3. Notify User
    if (contribution.user.email) {
      await sendMail({
        template: "gallery.contribution-rejected",
        to: contribution.user.email,
        entityId: contribution.id,
        build: (ctx) =>
          templates.gallery.contributionRejected(ctx, {
            name: contribution.user.name || "there",
            albumTitle: contribution.album.title,
            reason: reason?.trim() || undefined,
          }),
      });
    }
  }

  revalidatePath(`/admin/gallery/${contribution.albumId}`);
  revalidatePath(`/gallery/${contribution.albumId}`);
  revalidatePath("/admin/gallery/contributions");
  return { success: true };
}

export async function bulkModerateContributions(ids: string[], status: "APPROVED" | "REJECTED", reason?: string) {
  await requirePermission("gallery.contributions.moderate");

  // Process sequentially to handle side effects (Cloudinary/Email) properly for each
  const results = [];
  for (const id of ids) {
    try {
      const res = await moderateContribution(id, status, reason);
      results.push({ id, success: true });
    } catch (err: any) {
      results.push({ id, success: false, error: err.message });
    }
  }

  return { success: true, results };
}

export async function checkContributionEligibility(albumId: string) {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) return { eligible: false, reason: "AUTH_REQUIRED" };

  // Eligibility is matched on the email string, so an unverified address must
  // not count — otherwise changing the profile email to a checked-in
  // attendee's would grant their contribution rights.
  if (!(session.user as { emailVerified?: Date | null }).emailVerified) {
    return {
      eligible: false,
      reason: "EMAIL_UNVERIFIED",
      message: "Please verify your email address to contribute.",
    };
  }

  const album = await prisma.galleryAlbum.findUnique({
    where: { id: albumId },
    include: { event: true }
  });

  if (!album || !album.eventId) return { eligible: true }; // If no event linked, allow members

  const registration = await prisma.registration.findFirst({
    where: {
      eventId: album.eventId,
      email: { equals: session.user.email as string, mode: 'insensitive' },
      isCheckedIn: true
    }
  });

  if (!registration) {
    return { 
      eligible: false, 
      reason: "NOT_REGISTERED", 
      message: "To contribute, you must be registered and checked-in for this event." 
    };
  }

  return { eligible: true };
}

export async function getEligibleAlbumsForContribution() {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) return [];
  // Matched by email below — see the note in checkContributionEligibility.
  if (!(session.user as { emailVerified?: Date | null }).emailVerified) return [];

  // 1. Get all PAID and checked-in registrations for this user
  const registrations = await prisma.registration.findMany({
    where: {
      email: { equals: session.user.email as string, mode: 'insensitive' },
      isCheckedIn: true
    },
    select: { eventId: true }
  });

  const eventIds = registrations.map(r => r.eventId);

  // 2. Find albums linked to these events
  return await prisma.galleryAlbum.findMany({
    where: {
      eventId: { in: eventIds },
      isPublished: true
    },
    include: {
      _count: { select: { media: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}
