"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import { deleteFromCloudinary, uploadToCloudinary } from "./cloudinary";
import { cacheReelMedia, fetchReels, recordSyncError } from "./instagram";
import { reorderFeatured } from "./instagram-reorder";
import { validateUpload } from "./upload-validation";

export interface ReelCardData {
  id: string;
  caption: string | null;
  permalink: string;
  cloudinaryVideoUrl: string | null;
  cloudinaryThumbnailUrl: string | null;
  /** Instagram's own (temporary) thumbnail — a bridge for reels featured
   *  before a Cloudinary thumbnail existed to cache, or before this reel's
   *  cache attempt ever got that far. See ReelCardThumbnail. */
  igThumbnailUrl: string | null;
}

/**
 * Public — this is what the home page section fetches. Includes featured
 * reels that haven't finished caching yet (cloudinaryVideoUrl null), since
 * those still render as a gradient placeholder card rather than being
 * dropped from the strip.
 */
export async function getFeaturedReels(maxCount: number): Promise<ReelCardData[]> {
  const reels = await prisma.instagramReel.findMany({
    where: { featured: true },
    orderBy: { order: "asc" },
    take: maxCount,
  });

  return reels.map((r) => ({
    id: r.id,
    caption: r.caption,
    permalink: r.permalink,
    cloudinaryVideoUrl: r.cloudinaryVideoUrl,
    cloudinaryThumbnailUrl: r.cloudinaryThumbnailUrl,
    igThumbnailUrl: r.igThumbnailUrl,
  }));
}

export async function setReelFeatured(reelId: string, featured: boolean) {
  await requirePermission("reels.manage");

  if (featured) {
    const count = await prisma.instagramReel.count({ where: { featured: true } });
    await prisma.instagramReel.update({
      where: { id: reelId },
      data: { featured: true, order: count },
    });

    try {
      await cacheReelMedia(reelId);
    } catch (error) {
      // cacheReelMedia already recorded cacheError on the row; the reel stays
      // featured (so it shows the gradient placeholder) but the caller is
      // told the cache attempt failed, for the toast.
      revalidatePath("/admin/reels");
      revalidatePath("/");
      throw new Error(error instanceof Error ? error.message : "Failed to cache reel media");
    }
  } else {
    const reel = await prisma.instagramReel.findUnique({
      where: { id: reelId },
      select: { cloudinaryVideoUrl: true, cloudinaryThumbnailUrl: true },
    });

    await prisma.instagramReel.update({
      where: { id: reelId },
      data: {
        featured: false,
        order: 0,
        cloudinaryVideoUrl: null,
        cloudinaryThumbnailUrl: null,
        cachedAt: null,
        cacheError: null,
      },
    });

    // Best-effort cleanup: the cache only exists to serve the featured
    // strip, so an unfeatured reel has no reason to keep paying for it in
    // Cloudinary. Dedupe first — cacheReelMedia reuses the video URL as the
    // thumbnail when the post had no separate thumbnail of its own.
    const cachedUrls = [reel?.cloudinaryVideoUrl, reel?.cloudinaryThumbnailUrl].filter(
      (url, index, all): url is string => Boolean(url) && all.indexOf(url) === index
    );
    await Promise.all(cachedUrls.map((url) => deleteFromCloudinary(url)));

    // Renumber the remaining featured reels to close the gap this leaves,
    // so a later feature doesn't collide with an existing order value.
    const remaining = await prisma.instagramReel.findMany({
      where: { featured: true },
      orderBy: { order: "asc" },
    });
    await Promise.all(
      remaining.map((r, index) =>
        prisma.instagramReel.update({ where: { id: r.id }, data: { order: index } })
      )
    );
  }

  revalidatePath("/admin/reels");
  revalidatePath("/");
  return { success: true as const };
}

/**
 * Manual escape hatch for reels Instagram's Graph API won't hand over a
 * video for — most commonly a reel using licensed/trending audio, which
 * Meta excludes from `media_url` entirely (see the comment on
 * `cacheReelMedia`). There's nothing to re-fetch from Instagram in that
 * case, so an admin who has the original clip uploads it directly here,
 * bypassing Instagram for this one reel.
 *
 * The thumbnail is derived from the video itself — Cloudinary can deliver
 * any registered image format from a video's public path, so swapping the
 * extension to `.jpg` returns its first frame — rather than reusing the
 * `.mp4` URL as the poster the way `cacheReelMedia`'s no-separate-thumbnail
 * fallback does, which isn't a valid image src.
 */
export async function uploadReelVideo(reelId: string, formData: FormData) {
  await requirePermission("reels.manage");

  const reel = await prisma.instagramReel.findUnique({
    where: { id: reelId },
    select: { cloudinaryVideoUrl: true, cloudinaryThumbnailUrl: true },
  });
  if (!reel) throw new Error("Reel not found");

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");

  const { buffer } = await validateUpload(file, "video");
  const videoUrl = await uploadToCloudinary(buffer, "reels");
  const thumbnailUrl = videoUrl.replace(/\.[a-zA-Z0-9]+$/, ".jpg");

  await prisma.instagramReel.update({
    where: { id: reelId },
    data: {
      cloudinaryVideoUrl: videoUrl,
      cloudinaryThumbnailUrl: thumbnailUrl,
      cachedAt: new Date(),
      cacheError: null,
    },
  });

  // Best-effort: drop whatever this upload replaced so it doesn't linger in
  // Cloudinary unbilled-for-nothing. Dedupe in case both fields pointed at
  // the same asset.
  const oldUrls = [reel.cloudinaryVideoUrl, reel.cloudinaryThumbnailUrl].filter(
    (url, index, all): url is string => Boolean(url) && all.indexOf(url) === index
  );
  await Promise.all(oldUrls.map((url) => deleteFromCloudinary(url)));

  revalidatePath("/admin/reels");
  revalidatePath("/");
  return { success: true as const };
}

export async function reorderFeaturedReel(reelId: string, direction: "up" | "down") {
  await requirePermission("reels.manage");

  const featured = await prisma.instagramReel.findMany({
    where: { featured: true },
    orderBy: { order: "asc" },
  });

  const reordered = reorderFeatured(featured.map((r) => r.id), reelId, direction);

  await Promise.all(
    reordered.map((id, index) =>
      prisma.instagramReel.update({ where: { id }, data: { order: index } })
    )
  );

  revalidatePath("/admin/reels");
  revalidatePath("/");
  return { success: true as const };
}

export async function syncReelsNow() {
  await requirePermission("reels.manage");

  try {
    const result = await fetchReels();
    revalidatePath("/admin/reels");
    return { success: true as const, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await recordSyncError(message);
    revalidatePath("/admin/reels");
    throw new Error(message);
  }
}
