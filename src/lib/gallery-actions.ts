"use server";

import { prisma } from "./prisma";
import cloudinary from "./cloudinary";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { publicAuthOptions, adminAuthOptions } from "./auth";
import { sendEmail } from "./email";
import { 
  getContributionNotificationEmail, 
  getContributionApprovalEmail, 
  getContributionRejectionEmail 
} from "./email-templates";
import { getConfig } from "./config-utils";

export async function uploadImageAction(formData: FormData, folder?: string) {
  try {
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new Promise((resolve) => {
      cloudinary.uploader.upload_stream(
        {
          folder: folder || "kerala-samajam/gallery",
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

export async function deleteImageAction(publicId: string) {
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
  const album = await prisma.galleryAlbum.update({
    where: { id },
    data,
  });
  revalidatePath("/admin/gallery");
  revalidatePath(`/admin/gallery/${id}`);
  return { success: true, album };
}

export async function deleteAlbum(id: string) {
  // Cloudinary cleanup should ideally happen here too for all media in the album
  // For now, focus on DB
  await prisma.galleryAlbum.delete({
    where: { id },
  });
  revalidatePath("/admin/gallery");
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
  await deleteImageAction(publicId);
  await prisma.galleryMedia.delete({
    where: { id },
  });
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { success: true };
}

export async function bulkDeleteMedia(mediaItems: { id: string; publicId: string }[], albumId: string) {
  try {
    // 1. Delete from Cloudinary in parallel
    await Promise.all(mediaItems.map(item => deleteImageAction(item.publicId)));
    
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

export async function searchMediaByFace(descriptor: number[], albumId?: string) {
  // 1. Fetch all face detections
  const detections = await prisma.faceDetection.findMany({
    where: albumId ? { media: { albumId } } : undefined,
    include: { media: true },
  });

  // 2. Filter by Euclidean distance
  const threshold = 0.55;
  const matches = detections.filter(d => {
    const dist = euclideanDistance(descriptor, d.descriptor);
    return dist < threshold;
  });

  // 3. Return unique media items
  const mediaIds = Array.from(new Set(matches.map(m => m.mediaId)));
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
    const adminEmail = process.env.ADMIN_EMAIL || "ajmoviezone1@gmail.com";
    await sendEmail({
      to: adminEmail,
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
  const adminEmail = process.env.ADMIN_EMAIL || "ajmoviezone1@gmail.com";
  await sendEmail({
    to: adminEmail,
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
  const session = await getServerSession(adminAuthOptions);
  if (!session) throw new Error("Unauthorized");

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
  const session = await getServerSession(adminAuthOptions);
  if (!session) throw new Error("Unauthorized");

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
    await deleteImageAction(contribution.publicId);

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
  const session = await getServerSession(adminAuthOptions);
  if (!session) throw new Error("Unauthorized");

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
