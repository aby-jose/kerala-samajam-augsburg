import { breadcrumbJsonLd } from "@/lib/structured-data";
import { siteUrl } from "@/lib/site-url";

/**
 * Drops a `BreadcrumbList` script tag onto a public page. `items` runs
 * root-first and excludes "Home" — Google adds that itself from the site's
 * name. The last entry is the current page; give it no `url`.
 *
 * Silently renders nothing without a configured site URL, same as the rest
 * of the JSON-LD builders — a relative-only breadcrumb would be invalid.
 */
export function BreadcrumbJsonLd({ items }: { items: { name: string; url?: string }[] }) {
  const data = breadcrumbJsonLd(items, siteUrl());
  if (!data) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
