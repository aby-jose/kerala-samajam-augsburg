"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";

import { prisma } from "../prisma";
import { requirePermission } from "../guards";
import {
  isPageSlug,
  mergePageContent,
  normalizePageContentForSave,
  PAGE_CONTENT,
  type PageSlug,
} from "./registry";
import { pruneOrphanedCloudinaryUrls } from "../cloudinary";

/**
 * The live document for a page, or the built-in defaults if nothing has been
 * saved yet. Deduped per request like getAboutContent() — the public page and
 * the admin form can both call it without a duplicate round trip.
 *
 * A database error logs and returns the defaults rather than propagating.
 * Failing soft is right for copy: a config blip should not blank the contact
 * page. Do not copy the pattern to anything guarding data.
 */
export const getPageContent = cache(async (slug: PageSlug): Promise<Record<string, unknown>> => {
  try {
    const record = await prisma.pageContent.findUnique({ where: { slug } });
    if (!record || !record.value) return mergePageContent(slug, undefined);

    return mergePageContent(slug, record.value);
  } catch (error) {
    console.error(`Page content fetch error (${slug}):`, error);
    return mergePageContent(slug, undefined);
  }
});

export async function savePageContent(slug: string, data: unknown) {
  await requirePermission("content.pages.edit");

  // Checked after the permission, before anything is written: an unknown slug
  // is a bug in a caller, not a document to create. Silently upserting one
  // would leave a row nothing ever reads.
  if (!isPageSlug(slug)) throw new Error(`Unknown page: ${slug}`);

  const validated = PAGE_CONTENT[slug].schema.parse(normalizePageContentForSave(slug, data));

  try {
    const previous = await prisma.pageContent.findUnique({ where: { slug } });

    await prisma.pageContent.upsert({
      where: { slug },
      update: { value: validated as any },
      create: { slug, value: validated as any },
    });

    await pruneOrphanedCloudinaryUrls(previous?.value, validated);

    for (const path of PAGE_CONTENT[slug].revalidate) revalidatePath(path);
    revalidatePath(`/admin/pages/${slug}`);

    return { success: true };
  } catch (error) {
    console.error(`Failed to save page content (${slug}):`, error);
    throw new Error(`Failed to save ${PAGE_CONTENT[slug].label} page content`);
  }
}
