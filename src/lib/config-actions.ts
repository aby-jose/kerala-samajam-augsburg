"use server";

import { prisma } from "./prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { adminAuthOptions, publicAuthOptions } from "./auth";
import { SiteConfig } from "./config-schema";

import { getConfig } from "./config-utils";

export async function fetchConfigAction() {
  return await getConfig();
}

export async function saveConfig(config: SiteConfig) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  
  if ((session?.user as any)?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

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

    revalidatePath("/");
    revalidatePath("/admin/config");
    return { success: true };
  } catch (error) {
    console.error("Failed to save config:", error);
    throw new Error("Failed to save configuration");
  }
}
