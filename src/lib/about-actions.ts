"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";

import { prisma } from "./prisma";
import { requireAdmin } from "./guards";
import { aboutContentSchema, DEFAULT_ABOUT_CONTENT, type AboutContentT } from "./about-schema";

/**
 * The live About page content, or the built-in defaults if nothing has been
 * saved yet. Deduped per request like getConfig() — the public page and the
 * admin edit form can both call it without a duplicate DB round trip.
 */
export const getAboutContent = cache(async (): Promise<AboutContentT> => {
  try {
    const record = await prisma.aboutContent.findUnique({ where: { key: "current" } });
    if (!record || !record.value) return DEFAULT_ABOUT_CONTENT;

    // Merge over defaults so new fields introduced later don't break old
    // saved documents.
    const stored = record.value as Partial<AboutContentT>;
    return {
      ...DEFAULT_ABOUT_CONTENT,
      ...stored,
      cards: stored.cards?.length ? stored.cards : DEFAULT_ABOUT_CONTENT.cards,
    };
  } catch (error) {
    console.error("About content fetch error:", error);
    return DEFAULT_ABOUT_CONTENT;
  }
});

export async function saveAboutContent(data: AboutContentT) {
  await requireAdmin();

  const validated = aboutContentSchema.parse(data);

  try {
    await prisma.aboutContent.upsert({
      where: { key: "current" },
      update: { value: validated as any },
      create: { key: "current", value: validated as any },
    });

    revalidatePath("/about");
    revalidatePath("/admin/about");
    return { success: true };
  } catch (error) {
    console.error("Failed to save about content:", error);
    throw new Error("Failed to save About page content");
  }
}
