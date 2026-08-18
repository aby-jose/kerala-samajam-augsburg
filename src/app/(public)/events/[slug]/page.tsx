import type { Metadata } from "next";

import { getEventBySlug } from "@/lib/event-actions";
import { getConfig } from "@/lib/config-utils";
import { siteUrl } from "@/lib/site-url";
import { eventJsonLd } from "@/lib/structured-data";
import { EventDetailClient } from "./event-detail-client";

/**
 * A server wrapper around the client page below.
 *
 * The event detail view is entirely `"use client"` (countdown, live
 * registration state, session-aware pricing) so it has never been able to
 * export `generateMetadata` — every event page shared the site's one root
 * title, and Google had no per-event description, OG image, or Event
 * structured data to work with. This file fetches the event server-side just
 * for those two things and renders the unchanged client component for
 * everything else.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    return { title: "Event Not Found | Kerala Samajam Augsburg (KSA)" };
  }

  const description =
    event.description.length > 160
      ? `${event.description.slice(0, 157)}...`
      : event.description;

  return {
    title: `${event.title} | Kerala Samajam Augsburg (KSA)`,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      title: event.title,
      description,
      type: "website",
      images: event.imageUrl ? [event.imageUrl] : undefined,
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [event, config] = await Promise.all([getEventBySlug(slug), getConfig()]);

  return (
    <>
      {event ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              eventJsonLd(event, siteUrl(), config.legal.entityName || config.siteName)
            ),
          }}
        />
      ) : null}
      <EventDetailClient />
    </>
  );
}
