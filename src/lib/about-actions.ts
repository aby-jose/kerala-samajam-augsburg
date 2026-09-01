"use server";

import { cache } from "react";
import { revalidatePath, updateTag, unstable_cache } from "next/cache";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import {
  ABOUT_SECTION_IDS,
  aboutContentSchema,
  DEFAULT_ABOUT_CONTENT,
  liftLegacyAboutContent,
  mergeAboutContent,
  type AboutContentT,
} from "./about-schema";
import { ABOUT_SECTION_META } from "./about-sections";
import { enforceHideable, repairLayout } from "./page-layout";
import { pruneOrphanedCloudinaryUrls } from "./cloudinary";

/**
 * The Mongo read, cached across requests for 30s (tag "about-content"). The
 * about page is force-dynamic (see (public)/layout.tsx), so without this
 * every concurrent visitor triggered its own live fetch; this lets a 30s
 * window of traffic share one. saveAboutContent() calls
 * updateTag("about-content") on write, so an editor sees their own save
 * immediately regardless of the TTL.
 */
const fetchAboutContentRecord = unstable_cache(
  async () => prisma.aboutContent.findUnique({ where: { key: "current" } }),
  ["about-content"],
  { revalidate: 30, tags: ["about-content"] }
);

/**
 * The live About page content, or the built-in defaults if nothing has been
 * saved yet. Deduped per request like getHomeContent() — the public page and
 * the admin edit form can both call it without a duplicate DB round trip.
 */
export const getAboutContent = cache(async (): Promise<AboutContentT> => {
  try {
    const record = await fetchAboutContentRecord();
    if (!record || !record.value) return DEFAULT_ABOUT_CONTENT;

    // A document saved before sections were orderable has no `layout` key: its
    // own keys ARE the content. Lift it rather than merging it against the new
    // shape, where every field would read as unrecognised and be dropped —
    // silently reverting a page an administrator had already edited.
    const stored = record.value as Record<string, unknown>;
    const isLegacy = !("layout" in stored) && !("content" in stored);
    const content = isLegacy
      ? liftLegacyAboutContent(stored)
      : (stored as { content?: unknown }).content;
    const layout = isLegacy ? undefined : (stored as { layout?: unknown }).layout;

    return {
      layout: enforceHideable(
        ABOUT_SECTION_META,
        repairLayout(ABOUT_SECTION_IDS, ABOUT_SECTION_META, layout)
      ) as AboutContentT["layout"],
      content: mergeAboutContent(content),
    };
  } catch (error) {
    console.error("About content fetch error:", error);
    return DEFAULT_ABOUT_CONTENT;
  }
});

export async function saveAboutContent(data: AboutContentT) {
  await requirePermission("content.about.edit");

  const validated = aboutContentSchema.parse({
    ...data,
    layout: enforceHideable(
      ABOUT_SECTION_META,
      repairLayout(ABOUT_SECTION_IDS, ABOUT_SECTION_META, data.layout)
    ) as AboutContentT["layout"],
  });

  try {
    const previous = await prisma.aboutContent.findUnique({ where: { key: "current" } });

    await prisma.aboutContent.upsert({
      where: { key: "current" },
      update: { value: validated as any },
      create: { key: "current", value: validated as any },
    });

    await pruneOrphanedCloudinaryUrls(previous?.value, validated);

    revalidatePath("/about");
    revalidatePath("/admin/about");
    updateTag("about-content");
    return { success: true };
  } catch (error) {
    console.error("Failed to save about content:", error);
    throw new Error("Failed to save About page content");
  }
}
