import { AboutPageClient } from "@/components/layout/about-page-client";
import { getAboutContent } from "@/lib/about-actions";
import { getUpcomingEvents } from "@/lib/event-actions";

export const metadata = {
  title: "About Us | Kerala Samajam Augsburg (KSA)",
  description:
    "Kerala Samajam Augsburg (KSA) is the Malayali — Mallu — association in Augsburg, Bavaria — our story, our board, and what we do for the Kerala community here.",
};

export default async function AboutPage() {
  // Fetched here rather than by the closing "What's Coming Up" band itself —
  // see the same fix on the home page and on /events — so the band's event
  // links exist in the HTML this page actually serves, not just after a
  // client-side fetch resolves.
  const [content, events] = await Promise.all([
    getAboutContent(),
    getUpcomingEvents().catch((error) => {
      console.error("Upcoming events fetch error:", error);
      return [];
    }),
  ]);

  return <AboutPageClient content={content} events={events} />;
}
