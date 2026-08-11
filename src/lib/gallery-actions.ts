"use server";

import { NOT_REVOKED, prisma } from "./prisma";
import cloudinary from "./cloudinary";
import { enforceRateLimit } from "./rate-limit";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { publicAuthOptions } from "./auth";
import { requireAdmin, requireAnyUser, requireUser } from "./guards";
import { validateUpload } from "./upload-validation";
import { sendEmail } from "./email";
import { 
  getContributionNotificationEmail, 
  getContributionApprovalEmail, 
  getContributionRejectionEmail 
} from "./email-templates";
import { getConfig } from "./config-utils";
import { adminEmail } from "./admin-contact";

/**
 * Where a non-admin is allowed to put files.
 *
 * The folder arrives from the client, so without this a member could upload
 * into `branding/` and replace the site logo, or into `student-ids/` and
 * pollute the verification queue.
 */
const CONTRIBUTION_FOLDER_PREFIX = "kerala-samajam/contributions/";

export async function uploadImageAction(formData: FormData, folder?: string) {
  const user = await requireAnyUser();

  const requested = folder || "kerala-samajam/gallery";
  const target = user.isAdmin
    ? requested
    : requested.startsWith(CONTRIBUTION_FOLDER_PREFIX)
      ? requested
      : `${CONTRIBUTION_FOLDER_PREFIX}misc`;

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
 * Not exported: every export of a `"use server"` file is a POST endpoint, and
 * the admin-guarded `deleteImageAction` wrapper that used to sit here had no
 * callers at all — the delete paths below use this directly. An endpoint
 * nobody calls is surface without purpose.
 */
async function deleteImage(publicId: string) {
  try {
    await cloudinary.uploader.destroy(publicId);
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

export async function createAlbum(data: {
  title: string;
  description?: string;
  category?: string;
  eventId?: string; 
  coverImage?: string;
  isPublished?: boolean;
}) {
  await requireAdmin();

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
  await requireAdmin();

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
  await requireAdmin();

  const media = await prisma.galleryMedia.findMany({
    where: { albumId: id },
    select: { publicId: true },
  });

  const contributions = await prisma.mediaContribution.findMany({
    where: { albumId: id },
    select: { publicId: true },
  });

  const publicIds = [...media, ...contributions]
    .map((m) => m.publicId)
    .filter((publicId): publicId is string => !!publicId);

  const failures: string[] = [];
  for (const publicId of publicIds) {
    const result = await deleteImage(publicId);
    if ("error" in result) failures.push(publicId);
  }

  if (failures.length > 0) {
    console.error(
      `Album ${id}: ${failures.length}/${publicIds.length} assets could not be removed from Cloudinary.`,
      failures
    );
    return {
      error:
        `Could not delete ${failures.length} of ${publicIds.length} files from storage. ` +
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
  await requireAdmin();

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
  await requireAdmin();

  await deleteImage(publicId);
  await prisma.galleryMedia.delete({
    where: { id },
  });
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { success: true };
}

export async function bulkDeleteMedia(mediaItems: { id: string; publicId: string }[], albumId: string) {
  await requireAdmin();

  try {
    // 1. Delete from Cloudinary in parallel
    await Promise.all(mediaItems.map(item => deleteImage(item.publicId)));
    
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

export async function submitMediaContribution(data: {
  albumId: string;
  url: string;
  publicId: string;
  type: "IMAGE" | "VIDEO";
  width?: number;
  height?: number;
  caption?: string;
}, skipEmail?: boolean) {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) throw new Error("Authentication required");

  const album = await prisma.galleryAlbum.findUnique({ where: { id: data.albumId } });
  if (!album) throw new Error("Album not found");

  const contribution = await prisma.mediaContribution.create({
    data: {
      ...data,
      userId: session.user.id as string,
      status: "PENDING"
    }
  });

  // Notify Admin
  if (!skipEmail) {
    const config = await getConfig();
    const notifyAddress = adminEmail();
    await sendEmail({
      to: notifyAddress,
      subject: `New Media Contribution Request - ${config.siteName}`,
      html: getContributionNotificationEmail(session.user.name || "A member", album.title, { 
        logoUrl: config.branding.logoUrl, 
        siteName: config.siteName,
        primaryColor: config.branding.primaryColor
      })
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
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) throw new Error("Authentication required");

  const album = await prisma.galleryAlbum.findUnique({ where: { id: albumId } });
  if (!album) throw new Error("Album not found");

  const userId = session.user.id;
  const contributions = await prisma.mediaContribution.createMany({
    data: items.map(item => ({
      ...item,
      userId,
      albumId,
      status: "PENDING"
    }))
  });

  // Notify Admin ONCE
  const config = await getConfig();
  const notifyAddress = adminEmail();
  await sendEmail({
    to: notifyAddress,
    subject: `New Media Contributions (${items.length} items) - ${config.siteName}`,
    html: getContributionNotificationEmail(session.user.name || "A member", album.title, { 
      logoUrl: config.branding.logoUrl, 
      siteName: config.siteName,
      primaryColor: config.branding.primaryColor
    })
  });

  return { success: true, count: items.length };
}

export async function getPendingContributions() {
  await requireAdmin();

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
  await requireAdmin();

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
      const config = await getConfig();
      await sendEmail({
        to: contribution.user.email,
        subject: `Your media contribution was approved! - ${config.siteName}`,
        html: getContributionApprovalEmail(contribution.album.title, { 
          logoUrl: config.branding.logoUrl, 
          siteName: config.siteName,
          primaryColor: config.branding.primaryColor
        })
      });
    }
  } else {
    // 1. Delete from Cloudinary
    await deleteImage(contribution.publicId);

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
      const config = await getConfig();
      await sendEmail({
        to: contribution.user.email,
        subject: `Update regarding your media contribution - ${config.siteName}`,
        html: getContributionRejectionEmail(contribution.album.title, reason, { 
          logoUrl: config.branding.logoUrl, 
          siteName: config.siteName,
          primaryColor: config.branding.primaryColor
        })
      });
    }
  }

  revalidatePath(`/admin/gallery/${contribution.albumId}`);
  revalidatePath(`/gallery/${contribution.albumId}`);
  revalidatePath("/admin/gallery/contributions");
  return { success: true };
}

export async function bulkModerateContributions(ids: string[], status: "APPROVED" | "REJECTED", reason?: string) {
  await requireAdmin();

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
