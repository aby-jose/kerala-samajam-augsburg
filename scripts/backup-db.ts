/**
 * Backs up every collection in the MongoDB database (via Prisma Client).
 *
 * Usage:
 *   npx tsx scripts/backup-db.ts                    - local dump to timestamped JSON files under backups/<timestamp>/
 *   npx tsx scripts/backup-db.ts --upload            - bundle, gzip, encrypt, and upload a checkpoint to Cloudflare R2, then sweep retention
 *   npx tsx scripts/backup-db.ts --upload --dry-run  - run the upload path's dump/bundle steps without uploading anything
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { encryptBuffer } from "./lib/backup-crypto";
import { BACKUP_MODELS } from "./lib/backup-models";
import { checkpointsToDelete, formatTimestampKey, parseTimestampFromKey } from "./lib/retention";
import { createR2Client, deleteObjects, listObjects, loadR2ConfigFromEnv, uploadObject } from "./lib/r2-client";

const prisma = new PrismaClient();

function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function dumpAllModels(): Promise<{
  data: Record<string, unknown[]>;
  summary: Record<string, number | string>;
}> {
  const data: Record<string, unknown[]> = {};
  const summary: Record<string, number | string> = {};

  for (const model of BACKUP_MODELS) {
    try {
      // @ts-expect-error - dynamic model access
      const rows = await prisma[model].findMany();
      data[model] = rows;
      summary[model] = rows.length;
      console.log(`  ${model}: ${rows.length} docs`);
    } catch (err) {
      summary[model] = `ERROR: ${(err as Error).message}`;
      console.error(`  ${model}: FAILED - ${(err as Error).message}`);
    }
  }

  return { data, summary };
}

async function uploadCheckpoint(dryRun: boolean): Promise<void> {
  const { data, summary } = await dumpAllModels();
  const bundle = { ...data, _summary: summary };
  const gzipped = zlib.gzipSync(Buffer.from(JSON.stringify(bundle)));
  const key = `db-backups/${formatTimestampKey(new Date())}.json.gz.enc`;

  if (dryRun) {
    console.log(`\n[dry-run] would upload ${key} (${gzipped.length} bytes gzipped, unencrypted size shown)`);
    return;
  }

  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("BACKUP_ENCRYPTION_KEY is not set");
  const encrypted = encryptBuffer(gzipped, encryptionKey);

  const config = loadR2ConfigFromEnv();
  const client = createR2Client(config);
  await uploadObject(client, config.bucket, key, encrypted);
  console.log(`\nUploaded checkpoint: ${key}`);

  // The checkpoint is already safely uploaded at this point. Pruning old ones
  // exactly on schedule matters less than the run reporting success, so a
  // failing sweep is logged and swallowed rather than failing the whole run.
  try {
    const objects = await listObjects(client, config.bucket, "db-backups/");
    // Only sweep objects that really are checkpoints. Anything else under the
    // prefix (a stray upload, a hand-written note) is left alone rather than
    // aged out by its S3 lastModified.
    const checkpoints = objects.flatMap((o) => {
      if (!o.key.endsWith(".json.gz.enc")) return [];
      const timestamp = parseTimestampFromKey(o.key);
      return timestamp ? [{ key: o.key, timestamp }] : [];
    });
    const toDelete = checkpointsToDelete(checkpoints, new Date());
    if (toDelete.length > 0) {
      await deleteObjects(client, config.bucket, toDelete);
      console.log(`Retention: deleted ${toDelete.length} checkpoint(s) outside the retention window`);
    }
  } catch (e) {
    console.warn("Retention sweep failed (checkpoint upload succeeded):", (e as Error).message);
  }
}

async function main() {
  const upload = process.argv.includes("--upload");
  const dryRun = process.argv.includes("--dry-run");

  if (upload) {
    await uploadCheckpoint(dryRun);
    return;
  }

  // Unchanged: local timestamped JSON dump under backups/<timestamp>/.
  const outDir = path.join(process.cwd(), "backups", timestamp());
  fs.mkdirSync(outDir, { recursive: true });
  const { data, summary } = await dumpAllModels();
  for (const model of BACKUP_MODELS) {
    // Only models that actually dumped get a file. Writing `[]` for a model
    // whose findMany() threw would turn "we failed to back this up" into
    // "wipe this collection" at restore time — restore deleteMany({})s every
    // collection it finds a file for. The failure is recorded in _summary.json.
    if (!(model in data)) continue;
    fs.writeFileSync(
      path.join(outDir, `${model}.json`),
      JSON.stringify(data[model], null, 2),
      "utf-8"
    );
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
