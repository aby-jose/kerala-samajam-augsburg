"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import {
  DEFAULT_HOME_CONTENT,
  homeContentSchema,
  mergeHomeContent,
  type HomeContentT,
} from "./home-schema";
import { repairLayout } from "./home-layout";

/**
 * The live home page document, or the built-in defaults if nothing has been
 * saved yet. Deduped per request like getAboutContent() — the public page and
 * the admin form can both call it without a duplicate DB round trip.
 */
export const getHomeContent = cache(async (): Promise<HomeContentT> => {
  try {
    const record = await prisma.homeContent.findUnique({ where: { key: "current" } });
    if (!record || !record.value) return DEFAULT_HOME_CONTENT;

    const stored = record.value as { layout?: unknown; content?: unknown };

    return {
      layout: repairLayout(stored.layout),
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
    layout: repairLayout(data.layout),
  });

  try {
    await prisma.homeContent.upsert({
      where: { key: "current" },
      update: { value: validated as any },
      create: { key: "current", value: validated as any },
    });

    revalidatePath("/");
    revalidatePath("/admin/home");
    return { success: true };
  } catch (error) {
    console.error("Failed to save home content:", error);
    throw new Error("Failed to save Home page content");
  }
}
