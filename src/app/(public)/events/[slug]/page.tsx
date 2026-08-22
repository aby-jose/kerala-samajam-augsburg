import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getEventBySlug } from "@/lib/event-actions";
import { getConfig } from "@/lib/config-utils";
import { siteUrl } from "@/lib/site-url";
import { eventJsonLd } from "@/lib/structured-data";
import { EventDetailClient } from "./event-detail-client";

/**
 * A server wrapper around the client page below.
 *
 * The event detail view is entirely `"use client"` (countdown, live
 * registration state, session-aware pricing), and it used to fetch its own
 * event data in a `useEffect` after mount. That left two problems: every
 * event page shared the site's one root title with no per-event description,
 * OG image, or Event structured data, and — worse — the HTML actually sent to
 * a crawler was just a loading skeleton, since the real content only existed
 * after client-side JS fetched it. This file fetches the event server-side
 * once and both builds the metadata below and passes the event straight into
 * the client component, so the page's real content — and a real 404 for a
 * bad slug — are there in the first response.
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

  if (!event) {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            eventJsonLd(event, siteUrl(), config.legal.entityName || config.siteName)
          ),
        }}
      />
      <EventDetailClient event={event} />
    </>
  );
}
