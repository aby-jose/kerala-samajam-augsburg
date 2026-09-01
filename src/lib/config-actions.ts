"use server";

import { prisma } from "./prisma";
import { revalidatePath, updateTag } from "next/cache";
import { SiteConfig } from "./config-schema";
import { requirePermission } from "./guards";

import { getConfig } from "./config-utils";

export async function fetchConfigAction() {
  return await getConfig();
}

export async function saveConfig(config: SiteConfig) {
  await requirePermission("settings.edit");

  try {
    await prisma.config.upsert({
      where: { key: "current" },
      update: {
        value: config as any,
        updatedAt: new Date(),
      },
      create: {
        key: "current",
        value: config as any,
      },
    });

    // The brand colour lives on the root layout, so every cached route has to
    // go — "/" alone would leave the rest of the site on the old colour.
    revalidatePath("/", "layout");
    // Also drop the 10s cross-request cache (see config-utils.ts) so this
    // save — including a maintenance-mode flip — is visible immediately
    // rather than waiting out the TTL.
    updateTag("site-config");
    return { success: true };
  } catch (error) {
    console.error("Failed to save config:", error);
    throw new Error("Failed to save configuration");
  }
}
