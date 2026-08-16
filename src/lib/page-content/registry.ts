import { z } from "zod";

import { contactContentSchema, DEFAULT_CONTACT } from "./contact";

/**
 * What each page slug means: the shape of its document, the copy to fall back
 * on, and the routes whose cache a save invalidates.
 *
 * Kept free of prisma and React imports so the tests can read it under
 * Vitest's node environment — the actions that use it live next door in
 * actions.ts.
 */

export const PAGE_CONTENT = {
  contact: {
    label: "Contact",
    schema: contactContentSchema,
    defaults: DEFAULT_CONTACT,
    revalidate: ["/contact"],
  },
} as const satisfies Record<string, PageEntry>;

interface PageEntry {
  label: string;
  schema: z.ZodType<Record<string, unknown>>;
  defaults: Record<string, unknown>;
  revalidate: readonly string[];
}

export type PageSlug = keyof typeof PAGE_CONTENT;

export const PAGE_SLUGS = Object.keys(PAGE_CONTENT) as PageSlug[];

export const isPageSlug = (value: unknown): value is PageSlug =>
  typeof value === "string" && (PAGE_SLUGS as string[]).includes(value);

/**
 * Spread each stored section over its defaults, so a document saved before a
 * field existed keeps rendering rather than failing validation. Unknown
 * section keys are dropped: a field removed from a schema must not survive in
 * storage and reappear if the name is ever reused.
 *
 * One level deep by design — sections are merged, the fields inside them are
 * replaced wholesale. An array of FAQ items is a field, so an admin who
 * deletes one gets a document with one fewer, not a merge against the default
 * list.
 */
export function mergePageContent(slug: PageSlug, stored: unknown): Record<string, unknown> {
  const defaults = PAGE_CONTENT[slug].defaults as Record<string, unknown>;
  const source = (stored ?? {}) as Record<string, Record<string, unknown>>;

  const merged: Record<string, unknown> = {};

  for (const key of Object.keys(defaults)) {
    merged[key] = {
      ...(defaults[key] as Record<string, unknown>),
      ...(source[key] ?? {}),
    };
  }

  return merged;
}
