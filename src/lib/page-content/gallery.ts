import { z } from "zod";

import { sectionHeadingFields } from "./section";

/**
 * The Gallery page as one editable document. `layout` owns order and
 * visibility; `content` owns the words, keyed by section id so a field path
 * never changes when a section moves — see lib/page-content/gallery-sections.ts
 * for what each id renders as and lib/page-layout.ts for the generic
 * ordering rules shared with every other page.
 *
 * Split from the old flat `listings` document, which drove /events and
 * /gallery from a single, unordered document — see registry.ts for why one
 * order can no longer cover two pages. Every string below was moved
 * verbatim from the old `galleryHero`/`galleryAlbums`/`galleryContribute`
 * sections; this file renames keys, it does not rewrite copy.
 */
export const GALLERY_SECTION_IDS = ["hero", "albums", "contribute"] as const;

export type GallerySectionId = (typeof GALLERY_SECTION_IDS)[number];

const section = z.object({ ...sectionHeadingFields });

export const galleryHeroSectionSchema = section;

export const galleryAlbumsSectionSchema = z.object({
  eyebrow: sectionHeadingFields.eyebrow,
  title: sectionHeadingFields.title,
  accentWord: sectionHeadingFields.accentWord,
  // The albums grid has no lead today; keep the field optional so adding one
  // later is an edit rather than a migration.
  lead: z.string().max(500).optional().or(z.literal("")),
});

export const galleryContributeSectionSchema = section;

export const galleryContentSchema = z.object({
  layout: z
    .array(
      z.object({
        id: z.enum(GALLERY_SECTION_IDS),
        visible: z.boolean(),
      })
    )
    .min(1),
  content: z.object({
    hero: galleryHeroSectionSchema,
    albums: galleryAlbumsSectionSchema,
    contribute: galleryContributeSectionSchema,
  }),
});

export type GalleryContentT = z.infer<typeof galleryContentSchema>;
export type GalleryContentSections = GalleryContentT["content"];

/** Copy from gallery/page.tsx and gallery-landing-client.tsx, moved verbatim. */
export const DEFAULT_GALLERY: GalleryContentT = {
  layout: [
    { id: "hero", visible: true },
    { id: "albums", visible: true },
    { id: "contribute", visible: true },
  ],
  content: {
    hero: {
      eyebrow: "Gallery",
      title: "Photo Gallery",
      accentWord: "Gallery",
      lead: "Every sadhya, every stage and every picnic since 2012, sorted by album. Search by face to find the photos you are in.",
    },
    albums: {
      eyebrow: "Albums",
      title: "Browse the Archive",
      accentWord: "Archive",
      // Deliberately empty — see galleryAlbumsSectionSchema above and the
      // conditional render in gallery-landing-client.tsx. Not a placeholder
      // to fill in later by convention; the layout depends on it staying
      // absent.
      lead: "",
    },
    contribute: {
      eyebrow: "Contribute",
      title: "Share Your Photos",
      accentWord: "Photos",
      lead: "Took pictures at one of our events? Send them in and they will join the album, credited to you, once a moderator has had a look.",
    },
  },
};

/**
 * Spread each stored section over its defaults, so a document saved before a
 * field existed keeps rendering. Unknown section keys are dropped. No array
 * fields exist on this page today, so there is no LIST_FALLBACKS guard here —
 * see mergeContactContent for the pattern to follow if one is ever added.
 * Pure and prisma-free so tests can import it — see
 * getPageContent()/mergePageContent() for the caller.
 */
export function mergeGalleryContent(stored: unknown): GalleryContentSections {
  const source = (stored ?? {}) as Record<string, Record<string, unknown>>;

  const merged = {} as GalleryContentSections;

  for (const id of GALLERY_SECTION_IDS) {
    const defaults = DEFAULT_GALLERY.content[id] as Record<string, unknown>;
    (merged as Record<string, unknown>)[id] = { ...defaults, ...(source[id] ?? {}) };
  }

  return merged;
}
