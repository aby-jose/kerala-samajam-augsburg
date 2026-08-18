"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import { cacheReelMedia, fetchReels, recordSyncError } from "./instagram";
import { reorderFeatured } from "./instagram-reorder";

export interface ReelCardData {
  id: string;
  caption: string | null;
  permalink: string;
  cloudinaryVideoUrl: string | null;
  cloudinaryThumbnailUrl: string | null;
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
    await prisma.instagramReel.update({
      where: { id: reelId },
      data: { featured: false, order: 0 },
    });
  }

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
