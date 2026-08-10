/**
 * Seeds the six legal documents at version 1.
 *
 * Idempotent and non-destructive: a document that already exists is left
 * exactly as it is, because by then it is owned by the admin panel and may
 * carry wording the committee edited and members consented to. Re-running
 * this only fills in documents that are missing.
 *
 *   npx tsx prisma/seed-legal.ts
 *   npx tsx prisma/seed-legal.ts --force   # overwrite, keeping version numbers
 */

import { Prisma, PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

import { LEGAL_SEEDS } from "../src/lib/legal-content";

dotenv.config();

const prisma = new PrismaClient();
const force = process.argv.includes("--force");

async function main() {
  console.log(`Seeding legal documents${force ? " (force)" : ""}…`);

  for (const seed of LEGAL_SEEDS) {
    const existing = await prisma.legalDocument.findUnique({
      where: { slug: seed.slug },
    });

    if (existing && !force) {
      console.log(`  · ${seed.slug} — already present at v${existing.version}, skipped`);
      continue;
    }

    if (existing) {
      await prisma.legalDocument.update({
        where: { slug: seed.slug },
        data: {
          de: seed.de as unknown as Prisma.InputJsonValue,
          en: seed.en as unknown as Prisma.InputJsonValue,
        },
      });
      console.log(`  ✎ ${seed.slug} — content replaced, kept at v${existing.version}`);
      continue;
    }

    await prisma.legalDocument.create({
      data: {
        slug: seed.slug,
        version: 1,
        requiresConsent: seed.requiresConsent,
        isPublished: true,
        effectiveFrom: new Date(),
        de: seed.de as unknown as Prisma.InputJsonValue,
        en: seed.en as unknown as Prisma.InputJsonValue,
        changeNote: "Initial version.",
      },
    });
    console.log(`  + ${seed.slug} — created at v1`);
  }

  console.log(
    "\nDone. Fill in the {{placeholders}} under Admin → Settings → Organisation."
  );
}

main()
  .catch((error) => {
    console.error("Legal seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
