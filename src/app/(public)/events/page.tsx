import { getPageContent } from "@/lib/page-content/actions";
import type { EventsContentT } from "@/lib/page-content/events";
import { getUpcomingEvents } from "@/lib/event-actions";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { EventsClient } from "./events-client";

export const metadata = {
  title: "Events | Kerala Samajam Augsburg (KSA)",
  description:
    "Upcoming Malayali community events in Augsburg — Onam, Vishu, cultural evenings and gatherings from Kerala Samajam Augsburg. See dates and register.",
};

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  // Fetched here rather than by the client component: the list of events —
  // and every link to a registration page — used to only exist after a
  // useEffect fetch resolved in the browser, so the HTML search engines
  // actually crawled had no events on it at all. Same fix as the home page's
  // events band.
  const [content, events] = await Promise.all([
    getPageContent("events") as Promise<EventsContentT>,
    getUpcomingEvents().catch((error) => {
      console.error("Upcoming events fetch error:", error);
      return [];
    }),
  ]);

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Events" }]} />
      <EventsClient content={content} events={events} />
    </>
  );
}
