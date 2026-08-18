import { z } from "zod";

import { sectionHeadingFields } from "./section";

/**
 * The Contact page as one editable document. `layout` owns order and
 * visibility; `content` owns the words, keyed by section id so a field path
 * never changes when a section moves — see lib/page-content/contact-sections.ts
 * for what each id renders as and lib/page-layout.ts for the generic
 * ordering rules shared with every other page.
 */
export const CONTACT_SECTION_IDS = ["hero", "form", "faq", "visit", "whatsappCta"] as const;

export type ContactSectionId = (typeof CONTACT_SECTION_IDS)[number];

export const contactHeroSectionSchema = z.object({
  eyebrow: sectionHeadingFields.eyebrow,
  title: sectionHeadingFields.title,
  accentWord: sectionHeadingFields.accentWord,
  lead: sectionHeadingFields.lead,
});

export const contactFormSectionSchema = z.object({ ...sectionHeadingFields });

export const contactFaqSectionSchema = z.object({
  ...sectionHeadingFields,
  items: z
    .array(
      z.object({
        question: z.string().min(1, "Required").max(160),
        // Supports [label](/href) — see lib/page-content/section.ts.
        answer: z.string().min(1, "Required").max(600),
      })
    )
    .min(1, "At least one question is required")
    .max(12),
});

export const contactVisitSectionSchema = z.object({ ...sectionHeadingFields });
export const contactWhatsappCtaSectionSchema = z.object({ ...sectionHeadingFields });

export const contactContentSchema = z.object({
  layout: z
    .array(
      z.object({
        id: z.enum(CONTACT_SECTION_IDS),
        visible: z.boolean(),
      })
    )
    .min(1),
  content: z.object({
    hero: contactHeroSectionSchema,
    form: contactFormSectionSchema,
    faq: contactFaqSectionSchema,
    visit: contactVisitSectionSchema,
    whatsappCta: contactWhatsappCtaSectionSchema,
  }),
});

export type ContactContentT = z.infer<typeof contactContentSchema>;
export type ContactContentSections = ContactContentT["content"];

/** The copy that lived in app/(public)/contact/page.tsx before this editor. */
export const DEFAULT_CONTACT: ContactContentT = {
  layout: [
    { id: "hero", visible: true },
    { id: "form", visible: true },
    { id: "faq", visible: true },
    { id: "visit", visible: true },
    { id: "whatsappCta", visible: false },
  ],
  content: {
    hero: {
      eyebrow: "Contact",
      title: "Get in Touch",
      accentWord: "Touch",
      lead: "Questions about membership, an event, or moving to Augsburg? Write to us and a member of the committee will get back to you.",
    },
    form: {
      eyebrow: "Write to us",
      title: "Send a Message",
      accentWord: "Message",
      lead: "Everything here lands with the same handful of volunteers. Tell us what you need and we will point you at the right person.",
    },
    faq: {
      eyebrow: "Questions",
      title: "Asked Often",
      accentWord: "Often",
      lead: "The four we answer most weeks. If yours is not here, the form above is the place for it.",
      items: [
        {
          question: "Do I have to be a member to come?",
          answer:
            "Most of what we do is open to everyone. A few evenings are members-only, and the [event page](/events) always says so before you register.",
        },
        {
          question: "How do I join?",
          answer:
            "Apply through the [membership page](/membership). The committee confirms it, and the year's invitations start arriving from there.",
        },
        {
          question: "Can I bring the children?",
          answer:
            "Always. There is usually a corner of the hall that belongs entirely to them by the end of the evening.",
        },
        {
          question: "We have just moved to Augsburg.",
          answer:
            "Then write anyway. Anmeldung, flats, schools, insurance — someone here has done it recently and will walk you through it.",
        },
      ],
    },
    visit: {
      eyebrow: "Or simply turn up",
      title: "Come Say Hello In Person",
      accentWord: "In Person",
      lead: "Most of our events are open to everyone, and the easiest introduction is to walk in and eat with us. No message required.",
    },
    whatsappCta: {
      eyebrow: "Community Chat",
      title: "Join our WhatsApp Group",
      accentWord: "Group",
      lead: "Get every invitation, every class and every celebration directly in your chat. Stay updated and connected.",
    },
  },
};

/** Arrays that must never be left empty by a stored document — an admin who
 *  deletes every question gets the defaults back rather than a bare section. */
const LIST_FALLBACKS = {
  faq: ["items"],
} as const;

/**
 * Spread each stored section over its defaults, so a document saved before a
 * field existed keeps rendering. Unknown section keys are dropped; empty
 * arrays fall back to the defaults. Pure and prisma-free so tests can import
 * it — see getPageContent()/mergePageContent() for the caller.
 */
export function mergeContactContent(stored: unknown): ContactContentSections {
  const source = (stored ?? {}) as Record<string, Record<string, unknown>>;

  const merged = {} as ContactContentSections;

  for (const id of CONTACT_SECTION_IDS) {
    const defaults = DEFAULT_CONTACT.content[id] as Record<string, unknown>;
    const section = { ...defaults, ...(source[id] ?? {}) };

    for (const key of (LIST_FALLBACKS as Record<string, readonly string[]>)[id] ?? []) {
      const value = section[key];
      if (!Array.isArray(value) || value.length === 0) section[key] = defaults[key];
    }

    (merged as Record<string, unknown>)[id] = section;
  }

  return merged;
}
