import { z } from "zod";

import { enforceHideable, repairLayout, type SectionMeta } from "../page-layout";
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
import {
  eventsContentSchema,
  DEFAULT_EVENTS,
  EVENTS_SECTION_IDS,
  mergeEventsContent,
} from "./events";
import { EVENTS_SECTION_META } from "./events-sections";
import {
  galleryContentSchema,
  DEFAULT_GALLERY,
  GALLERY_SECTION_IDS,
  mergeGalleryContent,
} from "./gallery";
import { GALLERY_SECTION_META } from "./gallery-sections";

/**
 * What each page slug means: the shape of its document, the copy to fall back
 * on, and the routes whose cache a save invalidates.
 *
 * Kept free of prisma and React imports so the tests can read it under
 * Vitest's node environment — the actions that use it live next door in
 * actions.ts.
 *
 * Every registered page today carries `{layout, content}` — orderable,
 * hideable sections with position-derived backgrounds, the same contract as
 * the home and about pages (see lib/page-layout.ts). A `SectionedPageEntry`
 * carries `sectionIds`/`sectionMeta`/`mergeContent` so mergePageContent()
 * below can tell it apart from a flat page without a per-slug switch.
 *
 * `FlatPageEntry` is the shape every page used before section ordering
 * existed (`listings`, since split into `events` and `gallery`, was the last
 * one). Nothing registers one today — it is kept as a seam for a future page
 * that genuinely has no reason to reorder, not because one is needed right
 * now. See mergePageContent()'s flat branch for the same note.
 */

interface FlatPageEntry {
  label: string;
  schema: z.ZodType<Record<string, unknown>>;
  // A `{layout, content}`-shaped defaults object belongs to a
  // SectionedPageEntry, not this one. Without the `never`s below, a page
  // whose schema is sectioned but whose author forgot to also add
  // `sectionIds`/`sectionMeta`/`mergeContent` would still satisfy this
  // interface — TypeScript has no reason to reject `defaults: Record<string,
  // unknown>` just because two of its keys happen to be "layout" and
  // "content". It would then fall into isSectioned() === false and hit
  // mergePageContent()'s flat branch, which spreads over top-level keys as if
  // they were section names: `layout` (an array) and `content` (an object)
  // would each get merged as a "section", silently corrupting the layout
  // array instead of repairing it. Declaring both keys `never` here turns
  // that mistake into a compile error at the PAGE_CONTENT literal below,
  // where the object no longer structurally matches FlatPageEntry and (for a
  // page missing sectionIds/sectionMeta/mergeContent) doesn't match
  // SectionedPageEntry either.
  defaults: Record<string, unknown> & { layout?: never; content?: never };
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
  events: {
    label: "Events",
    schema: eventsContentSchema,
    defaults: DEFAULT_EVENTS,
    revalidate: ["/events"],
    sectionIds: EVENTS_SECTION_IDS,
    sectionMeta: EVENTS_SECTION_META,
    mergeContent: mergeEventsContent,
  },
  gallery: {
    label: "Gallery",
    schema: galleryContentSchema,
    defaults: DEFAULT_GALLERY,
    revalidate: ["/gallery"],
    sectionIds: GALLERY_SECTION_IDS,
    sectionMeta: GALLERY_SECTION_META,
    mergeContent: mergeGalleryContent,
  },
} as const satisfies Record<string, PageEntry>;

export type PageSlug = keyof typeof PAGE_CONTENT;

export const PAGE_SLUGS = Object.keys(PAGE_CONTENT) as PageSlug[];

export const isPageSlug = (value: unknown): value is PageSlug =>
  typeof value === "string" && (PAGE_SLUGS as string[]).includes(value);

/**
 * A document saved before sections were orderable has neither a `layout` key
 * nor a `content` key: its own top-level keys ARE the content, one key per
 * section id — `{hero, form, faq, visit}` for the pre-migration Contact
 * document (see `git show 2243c9c:src/lib/page-content/contact.ts`, the
 * shape shipped on `main` today). Feeding that into the sectioned branch
 * below would read `source.layout` and `source.content` as both undefined
 * and silently discard every stored field, reverting the page to defaults
 * with no error.
 *
 * A page with both keys is unambiguously the new shape (excluded here), and
 * a page with only one of the two is a partial new-shape document — not
 * legacy, just missing a field the merge already tolerates. Only "neither
 * key present" means "these ARE the section keys".
 *
 * Pure and exported so a node-environment test can exercise the exact check
 * mergePageContent() relies on, mirroring the inline check in
 * `getAboutContent()` (lib/about-actions.ts) that motivated this one.
 */
export function isLegacyPageContent(stored: unknown): boolean {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return false;

  return !("layout" in stored) && !("content" in stored);
}

/**
 * Spread each stored section over its defaults, so a document saved before a
 * field existed keeps rendering rather than failing validation. Unknown
 * section keys are dropped: a field removed from a schema must not survive in
 * storage and reappear if the name is ever reused.
 *
 * For a sectioned page (every page registered today) this repairs `layout`
 * with the generic page-layout.ts machinery and hands `content` off to the
 * page's own merge function — mirroring getAboutContent()'s read path, just
 * wired through the shared registry. A legacy flat document (see
 * isLegacyPageContent() above) is lifted rather than merged against the new
 * shape: each page's own mergeContent() already spreads top-level keys of
 * its argument over the section defaults, which is exactly what a legacy
 * document's own top-level keys need — so handing it the raw stored document
 * instead of `source.content` does the lift with no separate function
 * required, and the layout falls back to the default order since a legacy
 * document never had one.
 *
 * The flat branch below has no callers today (see FlatPageEntry's comment
 * above) and is one level deep by design — sections are merged, the fields
 * inside them are replaced wholesale. An array of FAQ items is a field, so an
 * admin who deletes one gets a document with one fewer, not a merge against
 * the default list.
 */
export function mergePageContent(slug: PageSlug, stored: unknown): Record<string, unknown> {
  const entry = PAGE_CONTENT[slug] as PageEntry;

  if (isSectioned(entry)) {
    if (isLegacyPageContent(stored)) {
      return {
        layout: enforceHideable(
          entry.sectionMeta,
          repairLayout(entry.sectionIds, entry.sectionMeta, undefined)
        ),
        content: entry.mergeContent(stored),
      };
    }

    const source = (stored ?? {}) as { layout?: unknown; content?: unknown };

    return {
      layout: enforceHideable(
        entry.sectionMeta,
        repairLayout(entry.sectionIds, entry.sectionMeta, source.layout)
      ),
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
 * collapse duplicates, pin unmovable sections, force non-hideable sections
 * visible) before the schema validates
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
    layout: enforceHideable(
      entry.sectionMeta,
      repairLayout(entry.sectionIds, entry.sectionMeta, record.layout)
    ),
  };
}
