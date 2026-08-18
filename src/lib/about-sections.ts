import { ABOUT_SECTION_IDS, type AboutSectionId } from "./about-schema";
import type { SectionMeta, SurfaceMode } from "./page-layout";

/**
 * How each section behaves on the page and how it is labelled in the admin
 * editor. Kept free of component imports so this module and the tests can
 * import it under Vitest's node environment — the id -> component map lives
 * in components/layout/about-page-client.tsx.
 */
export type { SurfaceMode };

export const ABOUT_SECTION_META: Record<AboutSectionId, SectionMeta> = {
  hero: {
    label: "Page header",
    description: "The eyebrow, title, lead paragraph and hero image at the top of the page.",
    surfaceMode: "rotate",
    // Carries the top padding that clears the transparent navbar on every
    // interior page (see PageHeader in section-heading.tsx). Moving it away
    // from the top would leave whatever section replaced it pressed flat
    // against the navbar with no clearance — the same reason the home
    // page's hero is pinned.
    movable: false,
    // navbar.tsx decides light-vs-dark navbar type from a hardcoded route
    // predicate, not from what actually renders at the top of the page.
    // Hiding this section would both collapse the opening whitespace above
    // and — if the section that slid into its place happened to be the
    // dark closing band — leave dark navbar type over a dark background,
    // unreadable until the user scrolls.
    hideable: false,
  },
  story: {
    label: "Where we come from",
    description: "The story heading and the cards underneath it.",
    surfaceMode: "rotate",
    movable: true,
  },
  committee: {
    label: "Committee",
    description: "The full committee list — the same component the home page previews.",
    surfaceMode: "rotate",
    movable: true,
  },
  closing: {
    label: "What's coming up",
    description: "The dark band listing upcoming events that closes the page.",
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
export const DEFAULT_ABOUT_SECTION_ORDER: readonly AboutSectionId[] = ABOUT_SECTION_IDS;
