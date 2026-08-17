import { z } from "zod";

import { repairLayout, type SectionMeta } from "../page-layout";
import {
  CONTACT_SECTION_IDS,
  contactContentSchema,
  DEFAULT_CONTACT,
  mergeContactContent,
} from "./contact";
import { CONTACT_SECTION_META } from "./contact-sections";
import {
  membershipContentSchema,
  DEFAULT_MEMBERSHIP,
  MEMBERSHIP_SECTION_IDS,
  mergeMembershipContent,
} from "./membership";
import { MEMBERSHIP_SECTION_META } from "./membership-sections";
import { listingsContentSchema, DEFAULT_LISTINGS } from "./listings";

/**
 * What each page slug means: the shape of its document, the copy to fall back
 * on, and the routes whose cache a save invalidates.
 *
 * Kept free of prisma and React imports so the tests can read it under
 * Vitest's node environment — the actions that use it live next door in
 * actions.ts.
 *
 * Two document shapes coexist here. `contact` and `membership` carry
 * `{layout, content}` — orderable, hideable sections with position-derived
 * backgrounds, the same contract as the home and about pages (see
 * lib/page-layout.ts). `listings` is still the flat shape every page used
 * before section ordering existed; it moves to the same shape once it splits
 * into `events` and `gallery`. A `SectionedPageEntry` carries `sectionIds`/
 * `sectionMeta`/`mergeContent` so mergePageContent() below can tell the two
 * apart without a per-slug switch.
 */

interface FlatPageEntry {
  label: string;
  schema: z.ZodType<Record<string, unknown>>;
  defaults: Record<string, unknown>;
  revalidate: readonly string[];
}

interface SectionedPageEntry {
  label: string;
  schema: z.ZodType<Record<string, unknown>>;
  defaults: { layout: { id: string; visible: boolean }[]; content: Record<string, unknown> };
  revalidate: readonly string[];
  sectionIds: readonly string[];
  sectionMeta: Record<string, SectionMeta>;
  mergeContent: (stored: unknown) => Record<string, unknown>;
}

type PageEntry = FlatPageEntry | SectionedPageEntry;

const isSectioned = (entry: PageEntry): entry is SectionedPageEntry => "sectionIds" in entry;

export const PAGE_CONTENT = {
  contact: {
    label: "Contact",
    schema: contactContentSchema,
    defaults: DEFAULT_CONTACT,
    revalidate: ["/contact"],
    sectionIds: CONTACT_SECTION_IDS,
    sectionMeta: CONTACT_SECTION_META,
    mergeContent: mergeContactContent,
  },
  membership: {
    label: "Membership",
    schema: membershipContentSchema,
    defaults: DEFAULT_MEMBERSHIP,
    revalidate: ["/membership"],
    sectionIds: MEMBERSHIP_SECTION_IDS,
    sectionMeta: MEMBERSHIP_SECTION_META,
    mergeContent: mergeMembershipContent,
  },
  listings: {
    label: "Events & Gallery",
    schema: listingsContentSchema,
    defaults: DEFAULT_LISTINGS,
    revalidate: ["/events", "/gallery"],
  },
} as const satisfies Record<string, PageEntry>;

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
 * For a sectioned page (`contact`, `membership`) this repairs `layout` with
 * the generic page-layout.ts machinery and hands `content` off to the page's
 * own merge function — mirroring getAboutContent()'s read path, just wired
 * through the shared registry so `listings` (still flat) is untouched.
 *
 * The flat branch below is one level deep by design — sections are merged,
 * the fields inside them are replaced wholesale. An array of FAQ items is a
 * field, so an admin who deletes one gets a document with one fewer, not a
 * merge against the default list.
 */
export function mergePageContent(slug: PageSlug, stored: unknown): Record<string, unknown> {
  const entry = PAGE_CONTENT[slug] as PageEntry;

  if (isSectioned(entry)) {
    const source = (stored ?? {}) as { layout?: unknown; content?: unknown };

    return {
      layout: repairLayout(entry.sectionIds, entry.sectionMeta, source.layout),
      content: entry.mergeContent(source.content),
    };
  }

  const defaults = entry.defaults as Record<string, unknown>;
  const source = (stored ?? {}) as Record<string, Record<string, unknown>>;

  const merged: Record<string, unknown> = {};

  for (const key of Object.keys(defaults)) {
    const defaultSection = defaults[key] as Record<string, unknown>;
    const mergedSection: Record<string, unknown> = {
      ...defaultSection,
      ...(source[key] ?? {}),
    };

    // An array field (faq.items, benefits.items, …) merged wholesale above
    // can come back an empty array if a document was written directly
    // against the database — the .min(1) on these schemas blocks saving one
    // through the form, but mergePageContent must not assume storage is
    // only ever written through the form. Restore the default list rather
    // than rendering a section with zero cells, the same guard
    // getAboutContent applies with `cards?.length ? … : DEFAULT.cards`.
    for (const fieldKey of Object.keys(defaultSection)) {
      const defaultValue = defaultSection[fieldKey];
      if (Array.isArray(defaultValue) && defaultValue.length > 0) {
        const mergedValue = mergedSection[fieldKey];
        if (!Array.isArray(mergedValue) || mergedValue.length === 0) {
          mergedSection[fieldKey] = defaultValue;
        }
      }
    }

    merged[key] = mergedSection;
  }

  return merged;
}

/**
 * Normalise a document about to be saved: for a sectioned page, repair its
 * `layout` the same way a stored one is repaired on read (drop unknown ids,
 * collapse duplicates, pin unmovable sections) before the schema validates
 * it. A flat page's document passes through unchanged. Kept here, next to
 * the shape knowledge it depends on, so actions.ts stays free of
 * page-layout.ts's specifics.
 */
export function normalizePageContentForSave(slug: PageSlug, data: unknown): unknown {
  const entry = PAGE_CONTENT[slug] as PageEntry;
  if (!isSectioned(entry)) return data;

  const record = (data ?? {}) as Record<string, unknown>;
  return {
    ...record,
    layout: repairLayout(entry.sectionIds, entry.sectionMeta, record.layout),
  };
}
