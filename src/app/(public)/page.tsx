import { HomePageClient } from "@/components/layout/home-page-client";
import { getHomeContent } from "@/lib/home-actions";
import { getUpcomingEvents } from "@/lib/event-actions";

// The page is prerendered statically, so without a revalidate window a newly
// published (or expired) event would only reach the home page on the next
// deploy. Sixty seconds keeps the events band close to live while the other
// six sections stay served from the static cache; admin content edits still
// land instantly because saveHomeContent() calls revalidatePath("/").
export const revalidate = 60;

export default async function Home() {
  const [content, events] = await Promise.all([
    getHomeContent(),
    // getUpcomingEvents() has no internal try/catch, and previously the
    // client-side fetch swallowed a failure and left the band empty. A bare
    // failure here would now fail the whole static render, so it is caught
    // the same way — the band falls back to its empty state and the rest of
    // the page still renders.
    getUpcomingEvents().catch((error) => {
      console.error("Upcoming events fetch error:", error);
      return [];
    }),
  ]);

  return (
    <HomePageClient
      content={content}
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
