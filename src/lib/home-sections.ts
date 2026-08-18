import { HOME_SECTION_IDS, type HomeSectionId } from "./home-schema";
import type { SectionMeta, SurfaceMode } from "./page-layout";

/**
 * How each section behaves on the page and how it is labelled in the admin
 * editor. Kept free of component imports so lib/home-layout.ts and the tests
 * can import it under Vitest's node environment — the id → component map
 * lives in components/layout/home-sections.tsx.
 */
export type { SurfaceMode };

export const HOME_SECTION_META: Record<HomeSectionId, SectionMeta> = {
  hero: {
    label: "Hero",
    description: "The full-height video banner at the top of the page.",
    surfaceMode: "media",
    // A full-height autoplaying video mid-page is not a layout the rest of
    // the design supports, and the navbar renders transparent over it.
    movable: false,
    // navbar.tsx gives the home route dark navbar type unconditionally
    // (`isHomePage`), independent of what actually renders there. Hide the
    // hero and the next visible section — a white "rotate" band by default —
    // would open the page with light navbar type on a white background:
    // illegible until the user scrolls. Not hideable for the same reason
    // it is not movable.
    hideable: false,
  },
  about: {
    label: "Who we are",
    description: "The story, the facts, the collage and the six things KSA does.",
    surfaceMode: "rotate",
    movable: true,
  },
  events: {
    label: "Upcoming events",
    description: "The next events from the calendar.",
    surfaceMode: "rotate",
    movable: true,
  },
  gallery: {
    label: "Photo gallery",
    description: "The mosaic of recent photographs.",
    surfaceMode: "rotate",
    movable: true,
  },
  reels: {
    label: "Instagram reels",
    description: "Featured reels synced from Instagram. Curated from the Reels admin screen.",
    surfaceMode: "rotate",
    movable: true,
  },
  committee: {
    label: "Committee",
    description: "This year's committee members.",
    surfaceMode: "rotate",
    movable: true,
  },
  join: {
    label: "How to join",
    description: "The three membership steps.",
    surfaceMode: "rotate",
    movable: true,
  },
  cta: {
    label: "Membership call to action",
    description: "The dark band that closes the page.",
    surfaceMode: "deep",
    movable: true,
  },
  whatsappCta: {
    label: "WhatsApp CTA",
    description: "The band inviting people to join the WhatsApp group.",
    surfaceMode: "rotate",
    movable: true,
  },
};

/** Section ids in the order the editor lists them when nothing is stored. */
export const DEFAULT_SECTION_ORDER: readonly HomeSectionId[] = HOME_SECTION_IDS;
