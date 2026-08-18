import { MEMBERSHIP_SECTION_IDS, type MembershipSectionId } from "./membership";
import type { SectionMeta, SurfaceMode } from "../page-layout";

/**
 * How each section behaves on the page and how it is labelled in the admin
 * editor. Kept free of component imports so this module and the tests can
 * import it under Vitest's node environment — the id -> component map lives
 * in components/public/membership-client.tsx.
 */
export type { SurfaceMode };

export const MEMBERSHIP_SECTION_META: Record<MembershipSectionId, SectionMeta> = {
  hero: {
    label: "Page header",
    description: "The eyebrow, title and lead paragraph at the top of the page.",
    surfaceMode: "rotate",
    // Carries the top padding that clears the transparent navbar on every
    // interior page (see PageHeader in section-heading.tsx). Moving it away
    // from the top would leave whatever section replaced it pressed flat
    // against the navbar with no clearance — the same reason About's hero is
    // pinned.
    movable: false,
    // navbar.tsx decides light-vs-dark navbar type from a hardcoded route
    // predicate, not from what actually renders at the top of the page.
    // Hiding this section would collapse the opening whitespace above it —
    // and on a page whose section-meta ever grows a `deep` surface, would
    // also risk leaving dark navbar type over a dark background until the
    // user scrolls, the same as About, Contact, Events and Gallery today.
    hideable: false,
  },
  plans: {
    label: "Plans",
    description: "The heading above the membership tiers. The tiers themselves are managed under Membership Plans.",
    surfaceMode: "rotate",
    movable: true,
  },
  benefits: {
    label: "Benefits",
    description: "The heading, image and benefit cards explaining what membership includes.",
    surfaceMode: "rotate",
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
export const DEFAULT_MEMBERSHIP_SECTION_ORDER: readonly MembershipSectionId[] = MEMBERSHIP_SECTION_IDS;
