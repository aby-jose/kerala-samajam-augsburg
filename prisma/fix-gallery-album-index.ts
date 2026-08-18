/**
 * Replaces GalleryAlbum's plain unique index on eventId with a partial one.
 *
 * Prisma's MongoDB connector has no `sparse`/partial attribute in the schema
 * DSL, so `eventId String? @unique` created a plain unique index. MongoDB
 * indexes a missing/null eventId as null, and a plain unique index allows
 * only one document with that null value — so only the very first standalone
 * album (no linked event) could ever be created; every one after it failed
 * with a duplicate-key error, which is exactly what made "Linked event
 * (optional)" not actually optional. A partial index that only applies to
 * documents where eventId exists keeps "one album per event" enforced while
 * letting any number of albums have no event at all.
 *
 * Idempotent — safe to re-run. Run with: npx tsx prisma/fix-gallery-album-index.ts
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const OLD_INDEX = "GalleryAlbum_eventId_key";
const NEW_INDEX = "GalleryAlbum_eventId_partial_unique";

async function main() {
  const indexes = await prisma.$runCommandRaw({
    listIndexes: "GalleryAlbum",
  }) as any;
  const existing: string[] = (indexes?.cursor?.firstBatch ?? []).map((i: any) => i.name);

  if (existing.includes(OLD_INDEX)) {
    await prisma.$runCommandRaw({ dropIndexes: "GalleryAlbum", index: OLD_INDEX });
    console.log(`  - dropped ${OLD_INDEX}`);
  } else {
    console.log(`  = ${OLD_INDEX} not present, nothing to drop`);
  }

  if (existing.includes(NEW_INDEX)) {
    console.log(`  = ${NEW_INDEX} already present, untouched`);
  } else {
    await prisma.$runCommandRaw({
      createIndexes: "GalleryAlbum",
      indexes: [
        {
          key: { eventId: 1 },
          name: NEW_INDEX,
          unique: true,
          partialFilterExpression: { eventId: { $exists: true } },
        },
      ],
    });
    console.log(`  + created ${NEW_INDEX} (unique, partial: eventId exists)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
