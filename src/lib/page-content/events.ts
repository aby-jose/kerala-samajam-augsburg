import { z } from "zod";

import { sectionHeadingFields } from "./section";

/**
 * The Events page as one editable document. `layout` owns order and
 * visibility; `content` owns the words, keyed by section id so a field path
 * never changes when a section moves — see lib/page-content/events-sections.ts
 * for what each id renders as and lib/page-layout.ts for the generic
 * ordering rules shared with every other page.
 *
 * Split from the old flat `listings` document, which drove /events and
 * /gallery from a single, unordered document — see registry.ts for why one
 * order can no longer cover two pages. Every string below was moved
 * verbatim from the old `eventsHero`/`eventsCalendar`/`eventsMembersBand`
 * sections; this file renames keys, it does not rewrite copy.
 */
export const EVENTS_SECTION_IDS = ["hero", "calendar", "membersBand", "whatsappCta"] as const;

export type EventsSectionId = (typeof EVENTS_SECTION_IDS)[number];

const section = z.object({ ...sectionHeadingFields });

export const eventsHeroSectionSchema = section;
export const eventsCalendarSectionSchema = section;
export const eventsMembersBandSectionSchema = section;
export const eventsWhatsappCtaSectionSchema = section;

export const eventsContentSchema = z.object({
  layout: z
    .array(
      z.object({
        id: z.enum(EVENTS_SECTION_IDS),
        visible: z.boolean(),
      })
    )
    .min(1),
  content: z.object({
    hero: eventsHeroSectionSchema,
    calendar: eventsCalendarSectionSchema,
    membersBand: eventsMembersBandSectionSchema,
    whatsappCta: eventsWhatsappCtaSectionSchema,
  }),
});

export type EventsContentT = z.infer<typeof eventsContentSchema>;
export type EventsContentSections = EventsContentT["content"];

/** Copy from app/(public)/events/page.tsx and events-client.tsx, moved verbatim. */
export const DEFAULT_EVENTS: EventsContentT = {
  layout: [
    { id: "hero", visible: true },
    { id: "calendar", visible: true },
    { id: "membersBand", visible: true },
    { id: "whatsappCta", visible: false },
  ],
  content: {
    hero: {
      eyebrow: "Events",
      title: "Upcoming Events",
      accentWord: "Events",
      lead: "Festivals, workshops and gatherings still to come. Most are open to everyone — bring a friend, and bring an appetite.",
    },
    calendar: {
      eyebrow: "Calendar",
      title: "Also on the Calendar",
      accentWord: "Calendar",
      lead: "Everything else already scheduled, in date order. Registration opens on each event's own page.",
    },
    membersBand: {
      eyebrow: "Members first",
      title: "Hear About Dates Before Anyone Else",
      accentWord: "Before",
      lead: "New dates usually go up a few weeks ahead, and members get the invitation first. Join, or just ask us what is being planned.",
    },
    whatsappCta: {
      eyebrow: "Community Chat",
      title: "Join our WhatsApp Group",
      accentWord: "Group",
      lead: "Get every invitation, every class and every celebration directly in your chat. Stay updated and connected.",
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
export function mergeEventsContent(stored: unknown): EventsContentSections {
  const source = (stored ?? {}) as Record<string, Record<string, unknown>>;

  const merged = {} as EventsContentSections;

  for (const id of EVENTS_SECTION_IDS) {
    const defaults = DEFAULT_EVENTS.content[id] as Record<string, unknown>;
    (merged as Record<string, unknown>)[id] = { ...defaults, ...(source[id] ?? {}) };
  }

  return merged;
}
