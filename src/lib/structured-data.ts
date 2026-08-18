import type { SiteConfig } from "./config-schema";

/**
 * JSON-LD builders for the public site.
 *
 * Both return plain objects rather than strings — callers drop the result
 * straight into a `<script type="application/ld+json">` via
 * `JSON.stringify`, same as everywhere else Next recommends embedding
 * structured data.
 */

/**
 * `defaultConfig.legal` ships with `{{PLACEHOLDER}}` strings for anything an
 * admin hasn't filled in yet (see `config-schema.ts`). Publishing one of
 * those verbatim in structured data would tell Google the association's
 * street address is literally "{{STRASSE UND HAUSNUMMER}}" — worse than
 * omitting the field.
 */
function isPlaceholder(value: string | undefined | null): boolean {
  return !value || value.includes("{{");
}

/** Organization schema, embedded once in the root layout so every page carries it. */
export function organizationJsonLd(config: SiteConfig, url: string | undefined) {
  const { legal, socials, branding, contactEmail, siteName, siteDescription } = config;

  const sameAs = Object.values(socials).filter((value): value is string => Boolean(value));

  const hasAddress = !isPlaceholder(legal.street) && !isPlaceholder(legal.postalCode);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: isPlaceholder(legal.entityName) ? siteName : legal.entityName,
    alternateName: siteName,
    description: siteDescription,
    ...(url ? { url } : {}),
    ...(branding.logoUrl ? { logo: branding.logoUrl } : {}),
    ...(contactEmail ? { email: contactEmail } : {}),
    ...(hasAddress
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: legal.street,
            postalCode: legal.postalCode,
            addressLocality: legal.city,
            addressCountry: legal.country === "Deutschland" ? "DE" : legal.country,
          },
        }
      : {}),
    areaServed: { "@type": "City", name: legal.city || "Augsburg" },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** Minimal shape `eventJsonLd` needs — matches the fields `getEventBySlug` selects. */
export interface EventForJsonLd {
  slug: string;
  title: string;
  description: string;
  date: Date;
  startTime?: string | null;
  endTime?: string | null;
  location: string;
  address?: string | null;
  imageUrl?: string | null;
  memberPrice?: number | null;
  nonMemberPrice?: number | null;
  status: "SCHEDULED" | "POSTPONED" | "CANCELLED";
}

/** Combines the event's date with an optional "HH:mm" time into an ISO string. */
function isoAt(date: Date, time?: string | null): string {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return date.toISOString();
  const [hours, minutes] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined.toISOString();
}

const EVENT_STATUS: Record<EventForJsonLd["status"], string> = {
  SCHEDULED: "https://schema.org/EventScheduled",
  POSTPONED: "https://schema.org/EventPostponed",
  CANCELLED: "https://schema.org/EventCancelled",
};

/** Event schema for one event's detail page. */
export function eventJsonLd(event: EventForJsonLd, url: string | undefined, entityName: string) {
  const lowestPrice = [event.memberPrice, event.nonMemberPrice].filter(
    (p): p is number => typeof p === "number"
  );

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: isoAt(event.date, event.startTime),
    ...(event.endTime ? { endDate: isoAt(event.date, event.endTime) } : {}),
    eventStatus: EVENT_STATUS[event.status],
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.location,
      ...(event.address ? { address: event.address } : {}),
    },
    ...(event.imageUrl ? { image: [event.imageUrl] } : {}),
    ...(url ? { url: `${url}/events/${event.slug}` } : {}),
    organizer: { "@type": "Organization", name: entityName },
    ...(lowestPrice.length
      ? {
          offers: {
            "@type": "Offer",
            price: Math.min(...lowestPrice).toFixed(2),
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            ...(url ? { url: `${url}/events/${event.slug}` } : {}),
          },
        }
      : {}),
  };
}
