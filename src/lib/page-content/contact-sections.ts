import { CONTACT_SECTION_IDS, type ContactSectionId } from "./contact";
import type { SectionMeta, SurfaceMode } from "../page-layout";

/**
 * How each section behaves on the page and how it is labelled in the admin
 * editor. Kept free of component imports so this module and the tests can
 * import it under Vitest's node environment — the id -> component map lives
 * in app/(public)/contact/contact-client.tsx.
 */
export type { SurfaceMode };

export const CONTACT_SECTION_META: Record<ContactSectionId, SectionMeta> = {
  hero: {
    label: "Page header",
    description: "The eyebrow, title, lead paragraph and the three ways to reach us at the top of the page.",
    surfaceMode: "rotate",
    // Carries the top padding that clears the transparent navbar on every
    // interior page (see PageHeader in section-heading.tsx). Moving it away
    // from the top would leave whatever section replaced it pressed flat
    // against the navbar with no clearance — the same reason About's hero is
    // pinned.
    movable: false,
    // navbar.tsx decides light-vs-dark navbar type from a hardcoded route
    // predicate, not from what actually renders at the top of the page.
    // Hiding this section would both collapse the opening whitespace above
    // and — if the section that slid into its place happened to be the
    // dark closing band — leave dark navbar type over a dark background,
    // unreadable until the user scrolls.
    hideable: false,
  },
  form: {
    label: "Message form",
    description: "The message form and the 'what happens next' steps beside it.",
    surfaceMode: "rotate",
    movable: true,
  },
  faq: {
    label: "Asked often",
    description: "The frequently asked questions grid.",
    surfaceMode: "rotate",
    movable: true,
  },
  visit: {
    label: "Come say hello",
    description: "The dark band closing the page, inviting people to just turn up.",
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
export const DEFAULT_CONTACT_SECTION_ORDER: readonly ContactSectionId[] = CONTACT_SECTION_IDS;
