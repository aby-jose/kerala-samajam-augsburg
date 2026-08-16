import { cache } from "react";
import { SiteConfig, defaultConfig } from "./config-schema";
import { prisma } from "./prisma";

// Deduped per request — the root layout and the section layouts both need it.
export const getConfig = cache(async (): Promise<SiteConfig> => {
  try {
    const configRecord = await prisma.config.findUnique({
      where: { key: "current" }
    });

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
      legal: { ...defaultConfig.legal, ...storedConfig.legal },
    };
  } catch (error) {
    console.error("Config fetch error:", error);
    return defaultConfig;
  }
});
