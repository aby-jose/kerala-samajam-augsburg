import { SiteConfig, defaultConfig } from "./config-schema";
import { prisma } from "./prisma";

export async function getConfig(): Promise<SiteConfig> {
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
      email: { ...defaultConfig.email, ...storedConfig.email },
      features: { ...defaultConfig.features, ...storedConfig.features },
    };
  } catch (error) {
    console.error("Config fetch error:", error);
    return defaultConfig;
  }
}
