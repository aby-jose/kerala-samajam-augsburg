import { z } from "zod";

import { sectionHeadingFields } from "./section";

const section = z.object({ ...sectionHeadingFields });

// The document is FLAT (eventsHero, galleryHero, …), not nested under
// { events: {...}, gallery: {...} } — mergePageContent merges one level
// deep, so nesting would replace a whole half wholesale on save.
export const listingsContentSchema = z.object({
  eventsHero: section,
  eventsCalendar: section,
  eventsMembersBand: section,
  galleryHero: section,
  galleryAlbums: z.object({
    eyebrow: sectionHeadingFields.eyebrow,
    title: sectionHeadingFields.title,
    accentWord: sectionHeadingFields.accentWord,
    // The albums grid has no lead today; keep the field optional so adding one
    // later is an edit rather than a migration.
    lead: z.string().max(500).optional().or(z.literal("")),
  }),
  galleryContribute: section,
});

export type ListingsContentT = z.infer<typeof listingsContentSchema>;

/** Copy from app/(public)/events/page.tsx and gallery/gallery-landing-client.tsx. */
export const DEFAULT_LISTINGS: ListingsContentT = {
  eventsHero: {
    eyebrow: "Events",
    title: "Upcoming Events",
    accentWord: "Events",
    lead: "Festivals, workshops and gatherings still to come. Most are open to everyone — bring a friend, and bring an appetite.",
  },
  eventsCalendar: {
    eyebrow: "Calendar",
    title: "Also on the Calendar",
    accentWord: "Calendar",
    lead: "Everything else already scheduled, in date order. Registration opens on each event's own page.",
  },
  eventsMembersBand: {
    eyebrow: "Members first",
    title: "Hear About Dates Before Anyone Else",
    accentWord: "Before",
    lead: "New dates usually go up a few weeks ahead, and members get the invitation first. Join, or just ask us what is being planned.",
  },
  galleryHero: {
    eyebrow: "Gallery",
    title: "Photo Gallery",
    accentWord: "Gallery",
    lead: "Every sadhya, every stage and every picnic since 2012, sorted by album. Search by face to find the photos you are in.",
  },
  galleryAlbums: {
    eyebrow: "Albums",
    title: "Browse the Archive",
    accentWord: "Archive",
    lead: "",
  },
  galleryContribute: {
    eyebrow: "Contribute",
    title: "Share Your Photos",
    accentWord: "Photos",
    lead: "Took pictures at one of our events? Send them in and they will join the album, credited to you, once a moderator has had a look.",
  },
};
