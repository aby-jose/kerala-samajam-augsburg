import { z } from "zod";

import { sectionHeadingFields } from "./section";

export const contactContentSchema = z.object({
  hero: z.object({
    eyebrow: sectionHeadingFields.eyebrow,
    title: sectionHeadingFields.title,
    accentWord: sectionHeadingFields.accentWord,
    lead: sectionHeadingFields.lead,
  }),
  form: z.object({ ...sectionHeadingFields }),
  faq: z.object({
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
  }),
  visit: z.object({ ...sectionHeadingFields }),
});

export type ContactContentT = z.infer<typeof contactContentSchema>;

/** The copy that lived in app/(public)/contact/page.tsx before this editor. */
export const DEFAULT_CONTACT: ContactContentT = {
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
};
