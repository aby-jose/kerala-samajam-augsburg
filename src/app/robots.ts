import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Admin panel and API routes already send X-Robots-Tag: noindex (see
      // next.config.ts); /profile, /verify-email and /unsubscribe are
      // token-gated or personal pages with nothing for a crawler to index.
      disallow: ["/admin", "/api", "/profile", "/verify-email", "/unsubscribe"],
    },
    // Omitted with no configured domain — same reasoning as sitemap.ts.
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
