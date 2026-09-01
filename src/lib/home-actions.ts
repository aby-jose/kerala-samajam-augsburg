"use server";

import { cache } from "react";
import { revalidatePath, updateTag, unstable_cache } from "next/cache";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import {
  DEFAULT_HOME_CONTENT,
  homeContentSchema,
  mergeHomeContent,
  type HomeContentT,
} from "./home-schema";
import { repairLayout } from "./home-layout";
import { HOME_SECTION_META } from "./home-sections";
import { enforceHideable } from "./page-layout";
import { pruneOrphanedCloudinaryUrls } from "./cloudinary";

/**
 * The Mongo read, cached across requests for 30s (tag "home-content"). The
 * home page is force-dynamic (see (public)/layout.tsx), so without this every
 * concurrent visitor triggered its own live fetch; this lets a 30s window of
 * traffic share one. saveHomeContent() calls updateTag("home-content") on
 * write, so an editor sees their own save immediately regardless of the TTL.
 */
const fetchHomeContentRecord = unstable_cache(
  async () => prisma.homeContent.findUnique({ where: { key: "current" } }),
  ["home-content"],
  { revalidate: 30, tags: ["home-content"] }
);

/**
 * The live home page document, or the built-in defaults if nothing has been
 * saved yet. Deduped per request like getAboutContent() — the public page and
 * the admin form can both call it without a duplicate DB round trip.
 */
export const getHomeContent = cache(async (): Promise<HomeContentT> => {
  try {
    const record = await fetchHomeContentRecord();
    if (!record || !record.value) return DEFAULT_HOME_CONTENT;

    const stored = record.value as { layout?: unknown; content?: unknown };

    return {
      layout: enforceHideable(HOME_SECTION_META, repairLayout(stored.layout)) as HomeContentT["layout"],
      content: mergeHomeContent(stored.content),
    };
  } catch (error) {
    console.error("Home content fetch error:", error);
    return DEFAULT_HOME_CONTENT;
  }
});

export async function saveHomeContent(data: HomeContentT) {
  await requirePermission("content.home.edit");

  const validated = homeContentSchema.parse({
    ...data,
    layout: enforceHideable(HOME_SECTION_META, repairLayout(data.layout)) as HomeContentT["layout"],
  });

  try {
    // Read before the overwrite — this is the only chance to see what media
    // the previous save referenced that this one no longer does.
    const previous = await prisma.homeContent.findUnique({ where: { key: "current" } });

    await prisma.homeContent.upsert({
      where: { key: "current" },
      update: { value: validated as any },
      create: { key: "current", value: validated as any },
    });

    await pruneOrphanedCloudinaryUrls(previous?.value, validated);

    revalidatePath("/");
    revalidatePath("/admin/home");
    updateTag("home-content");
    return { success: true };
  } catch (error) {
    console.error("Failed to save home content:", error);
    throw new Error("Failed to save Home page content");
  }
}
