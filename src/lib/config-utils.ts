import { cache } from "react";
import { unstable_cache } from "next/cache";
import { SiteConfig, defaultConfig } from "./config-schema";
import { prisma } from "./prisma";

/**
 * The Mongo read, cached across requests for 10s (tag "site-config").
 *
 * The public layout is force-dynamic so the maintenance lock never serves
 * stale HTML — see (public)/layout.tsx — which means this fetch used to run
 * fresh on *every* request to *every* public page. Under load that was a live
 * DB round trip per concurrent visitor with nothing shared between them; this
 * cache lets 10s of concurrent traffic share one fetch instead. saveConfig()
 * calls updateTag("site-config") on write, so an admin's own save is
 * never behind the TTL — only other visitors wait out the 10s at most, which
 * is the deliberate trade for how responsive the kill switch needs to be.
 */
const fetchConfigRecord = unstable_cache(
  async () => prisma.config.findUnique({ where: { key: "current" } }),
  ["site-config"],
  { revalidate: 10, tags: ["site-config"] }
);

// Deduped per request — the root layout and the section layouts both need it.
export const getConfig = cache(async (): Promise<SiteConfig> => {
  try {
    const configRecord = await fetchConfigRecord();

    if (!configRecord || !configRecord.value) {
      return defaultConfig;
    }

    // Merge defaults with stored config to handle new fields
    const storedConfig = configRecord.value as Partial<SiteConfig>;
    return {
      ...defaultConfig,
      ...storedConfig,
      socials: { ...defaultConfig.socials, ...storedConfig.socials },
      branding: { ...defaultConfig.branding, ...storedConfig.branding },
      email: {
        ...defaultConfig.email,
        ...storedConfig.email,
        // A shallow merge alone would drop any automated-email switch added
        // after a config was last saved — it replaces the whole `automated`
        // object rather than filling in the missing key.
        automated: { ...defaultConfig.email.automated, ...storedConfig.email?.automated },
        notifications: { ...defaultConfig.email.notifications, ...storedConfig.email?.notifications },
      },
      features: { ...defaultConfig.features, ...storedConfig.features },
      membership: { ...defaultConfig.membership, ...storedConfig.membership },
      legal: { ...defaultConfig.legal, ...storedConfig.legal },
    };
  } catch (error) {
    console.error("Config fetch error:", error);
    return defaultConfig;
  }
});
