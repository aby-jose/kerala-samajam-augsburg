/**
 * Backs up every collection in the MongoDB database (via Prisma Client) to
 * timestamped JSON files under backups/<timestamp>/.
 *
 * Usage: npx tsx scripts/backup-db.ts
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Model accessor names on PrismaClient (camelCase), mapped 1:1 to schema models.
const MODELS = [
  "config",
  "aboutContent",
  "homeContent",
  "pageContent",
  "legalDocument",
  "legalRevision",
  "userConsent",
  "cookieConsent",
  "event",
  "registration",
  "galleryAlbum",
  "galleryMedia",
  "faceDetection",
  "instagramReel",
  "instagramSyncState",
  "account",
  "session",
  "user",
  "emailLog",
  "userFaceProfile",
  "membershipPlan",
  "subscription",
  "verificationToken",
  "passwordResetToken",
  "leadershipMember",
  "mediaContribution",
  "contactMessage",
  "captcha",
  "rateLimit",
  "role",
  "staffInvite",
  "auditLog",
] as const;

function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  const outDir = path.join(process.cwd(), "backups", timestamp());
  fs.mkdirSync(outDir, { recursive: true });

  const summary: Record<string, number | string> = {};

  for (const model of MODELS) {
    try {
      // @ts-expect-error - dynamic model access
      const rows = await prisma[model].findMany();
      fs.writeFileSync(
        path.join(outDir, `${model}.json`),
        JSON.stringify(rows, null, 2),
        "utf-8"
      );
      summary[model] = rows.length;
      console.log(`  ${model}: ${rows.length} docs`);
    } catch (err) {
      summary[model] = `ERROR: ${(err as Error).message}`;
      console.error(`  ${model}: FAILED - ${(err as Error).message}`);
    }
  }

  fs.writeFileSync(
    path.join(outDir, "_summary.json"),
    JSON.stringify(summary, null, 2),
    "utf-8"
  );

  console.log(`\nBackup written to: ${outDir}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
