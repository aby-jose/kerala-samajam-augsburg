import { HomePageClient } from "@/components/layout/home-page-client";
import { getHomeContent } from "@/lib/home-actions";
import { getUpcomingEvents } from "@/lib/event-actions";
import { getConfig } from "@/lib/config-utils";
import type { HomeSectionId } from "@/lib/home-schema";

/**
 * Which module switch, if any, governs a section.
 *
 * A switched-off module 404s its own route, so leaving its section on the home
 * page would send a visitor from a polished panel straight into a not-found
 * page. The join steps and the closing call to action both lead to
 * `/membership`, so both answer to the same switch.
 *
 * There is deliberately no entry for `events`: the events module gates
 * *registration*, not the calendar, and the band degrades to its own empty
 * state on its own.
 */
const SECTION_FEATURE: Partial<Record<HomeSectionId, "enableGallery" | "enableMembership">> = {
  gallery: "enableGallery",
  join: "enableMembership",
  cta: "enableMembership",
};

// No `revalidate` here. `(public)/layout.tsx` is `force-dynamic`, so this page
// is server-rendered per request and the ISR window it used to carry could
// never apply. That is also what keeps the module switches honest: a lever
// thrown in Settings takes effect on the next request rather than whenever a
// cache entry happened to expire.

export default async function Home() {
  const [content, config, events] = await Promise.all([
    getHomeContent(),
    getConfig(),
    // getUpcomingEvents() has no internal try/catch, and the client-side fetch
    // this replaced swallowed a failure and left the band empty. A bare failure
    // here would fail the whole render, so it is caught the same way — the band
    // falls back to its empty state and the rest of the page still renders.
    getUpcomingEvents().catch((error) => {
      console.error("Upcoming events fetch error:", error);
      return [];
    }),
  ]);

  // Hidden rather than removed: `resolveSections` skips invisible sections and
  // derives each surface from its position among the ones that remain, so the
  // page's alternating backgrounds stay correct with a section missing. Cutting
  // entries out of the array instead would also be undone by `repairLayout`,
  // which re-appends any section id it does not find.
  const layout = content.layout.map((section) => {
    const feature = SECTION_FEATURE[section.id];

    return feature && !config.features[feature]
      ? { ...section, visible: false }
      : section;
  });

  return (
    <HomePageClient
      content={{ ...content, layout }}
      events={events.slice(0, content.content.events.count).map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        date: e.date.toISOString(),
        location: e.location,
        description: e.description,
        image: e.imageUrl || "/images/placeholder.svg",
      }))}
    />
  );
}
