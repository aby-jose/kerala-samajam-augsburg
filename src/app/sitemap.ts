import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config-utils";
import { LEGAL_SLUGS } from "@/lib/legal-schema";
import { siteUrl } from "@/lib/site-url";

// Events and albums get added/unpublished outside a deploy, so this has to
// run per request rather than being frozen in at build time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  // Without a configured domain there's nowhere to point crawlers at — an
  // absolute URL built from `undefined` would just be the string
  // "undefined/events", which is worse than publishing nothing.
  if (!base) return [];

  const { features } = await getConfig();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/events`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.5 },
  ];

  if (features.enableMembership) {
    staticPages.push({ url: `${base}/membership`, changeFrequency: "monthly", priority: 0.7 });
  }
  if (features.enableGallery) {
    staticPages.push({ url: `${base}/gallery`, changeFrequency: "weekly", priority: 0.6 });
  }

  // Low priority — mandatory reading, not what anyone is searching for — but
  // still real, public pages worth a crawler knowing about.
  const legalPages: MetadataRoute.Sitemap = LEGAL_SLUGS.map((slug) => ({
    url: `${base}/legal/${slug}`,
    changeFrequency: "yearly",
    priority: 0.2,
  }));

  const [events, albums] = await Promise.all([
    prisma.event.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
    features.enableGallery
      ? prisma.galleryAlbum.findMany({
          where: { isPublished: true },
          select: { id: true, updatedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${base}/events/${event.slug}`,
    lastModified: event.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const albumPages: MetadataRoute.Sitemap = albums.map((album) => ({
    url: `${base}/gallery/${album.id}`,
    lastModified: album.updatedAt,
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...staticPages, ...legalPages, ...eventPages, ...albumPages];
}
