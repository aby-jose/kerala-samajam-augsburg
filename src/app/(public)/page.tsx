import { HomePageClient } from "@/components/layout/home-page-client";
import { getHomeContent } from "@/lib/home-actions";
import { getUpcomingEvents } from "@/lib/event-actions";

export default async function Home() {
  const [content, events] = await Promise.all([getHomeContent(), getUpcomingEvents()]);

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
