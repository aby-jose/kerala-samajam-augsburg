/**
 * Restores the database from a JSON backup produced by scripts/backup-db.ts,
 * either from a local backup directory or from an encrypted checkpoint
 * stored in R2 (see scripts/backup-db.ts).
 *
 * This is a WIPE + RESTORE: every collection listed below is fully emptied
 * and then repopulated with exactly what's in the backup file. Anything
 * written to the live db after the backup was taken is lost. Runs inside a
 * single multi-document transaction so a failure partway through rolls back
 * instead of leaving the db half-wiped.
 *
 * Goes through the native MongoDB driver, not Prisma Client: a raw
 * wipe-then-insert must reproduce the exact original BSON (ObjectId/Date
 * types), and Prisma's emulated relation-integrity checks would reject
 * inserting rows out of dependency order.
 *
 * Every restore — local directory or remote --key — first prints a
 * before/after row-count diff and writes nothing until --confirm is passed.
 *
 * Usage:
 *   npx tsx scripts/restore-db.ts --list
 *     List available remote checkpoints in R2 (db-backups/).
 *   npx tsx scripts/restore-db.ts [<backup-dir-name>] [--confirm]
 *     Restore from a local backup directory under backups/. Defaults to the
 *     most recent one if omitted. Without --confirm, only prints the diff.
 *   npx tsx scripts/restore-db.ts --key <checkpoint> [--confirm]
 *     Download and restore from a remote checkpoint (e.g. the key printed
 *     by --list, such as db-backups/20260818-134452.json.gz.enc). Without
 *     --confirm, only prints the diff.
 */
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import os from "os";
import { decryptBuffer } from "./lib/backup-crypto";
import { createR2Client, downloadObject, listObjects, loadR2ConfigFromEnv } from "./lib/r2-client";

// Field-level type info the JSON export can't carry on its own: which fields
// are ObjectId-typed (stored as hex strings in the JSON) and which are
// DateTime-typed (stored as ISO strings). Mirrors prisma/schema.prisma.
const MODEL_CONFIG: Record<
  string,
  { objectIdFields: string[]; dateFields: string[] }
> = {
  Config: { objectIdFields: [], dateFields: ["updatedAt"] },
  AboutContent: { objectIdFields: [], dateFields: ["updatedAt"] },
  HomeContent: { objectIdFields: [], dateFields: ["updatedAt"] },
  PageContent: { objectIdFields: [], dateFields: ["updatedAt"] },
  LegalDocument: {
    objectIdFields: [],
    dateFields: ["effectiveFrom", "createdAt", "updatedAt"],
  },
  LegalRevision: {
    objectIdFields: ["documentId"],
    dateFields: ["publishedAt"],
  },
  UserConsent: {
    objectIdFields: ["userId"],
    dateFields: ["revokedAt", "createdAt"],
  },
  CookieConsent: { objectIdFields: [], dateFields: ["createdAt", "updatedAt"] },
  Event: {
    objectIdFields: [],
    dateFields: ["date", "cancelledAt", "createdAt", "updatedAt"],
  },
  Registration: {
    objectIdFields: ["eventId", "recordedById"],
    dateFields: ["checkInTime", "paidAt", "recordedAt", "createdAt"],
  },
  GalleryAlbum: {
    objectIdFields: ["eventId"],
    dateFields: ["createdAt", "updatedAt"],
  },
  GalleryMedia: { objectIdFields: ["albumId"], dateFields: ["createdAt"] },
  FaceDetection: { objectIdFields: ["mediaId"], dateFields: ["createdAt"] },
  InstagramReel: {
    objectIdFields: [],
    dateFields: ["postedAt", "cachedAt", "syncedAt", "createdAt"],
  },
  InstagramSyncState: {
    objectIdFields: [],
    dateFields: ["tokenExpiresAt", "lastSyncAt", "lastTokenRefreshAt", "updatedAt"],
  },
  Account: { objectIdFields: ["userId"], dateFields: [] },
  Session: { objectIdFields: ["userId"], dateFields: ["expires"] },
  User: {
    objectIdFields: ["staffRoleId"],
    dateFields: [
      "passwordChangedAt",
      "emailVerified",
      "dob",
      "createdAt",
      "updatedAt",
      "deletionRequestedAt",
      "anonymizedAt",
    ],
  },
  EmailLog: { objectIdFields: [], dateFields: ["createdAt", "sentAt"] },
  UserFaceProfile: { objectIdFields: ["userId"], dateFields: ["updatedAt"] },
  MembershipPlan: { objectIdFields: [], dateFields: ["createdAt", "updatedAt"] },
  Subscription: {
    objectIdFields: ["userId", "planId", "recordedById"],
    dateFields: ["startDate", "endDate", "recordedAt", "createdAt", "updatedAt"],
  },
  VerificationToken: { objectIdFields: [], dateFields: ["expires"] },
  PasswordResetToken: { objectIdFields: [], dateFields: ["expires"] },
  LeadershipMember: { objectIdFields: [], dateFields: ["createdAt", "updatedAt"] },
  MediaContribution: {
    objectIdFields: ["userId", "albumId"],
    dateFields: ["createdAt", "updatedAt"],
  },
  ContactMessage: { objectIdFields: [], dateFields: ["createdAt", "updatedAt"] },
  Captcha: { objectIdFields: [], dateFields: ["expires"] },
  RateLimit: { objectIdFields: [], dateFields: ["resetAt"] },
  Role: { objectIdFields: [], dateFields: ["createdAt", "updatedAt"] },
  StaffInvite: {
    objectIdFields: ["roleId", "invitedById"],
    dateFields: ["expires", "acceptedAt", "revokedAt", "createdAt"],
  },
  AuditLog: { objectIdFields: ["actorId"], dateFields: ["createdAt"] },
};

// backup-db.ts filenames use the camelCase Prisma accessor name; Mongo
// collections use the PascalCase model name (no @@map overrides in schema).
const modelNameFor = (fileBase: string) =>
  fileBase.charAt(0).toUpperCase() + fileBase.slice(1);

function reviveDoc(raw: any, cfg: { objectIdFields: string[]; dateFields: string[] }) {
  const doc: any = { ...raw };

  if (doc.id != null) {
    doc._id = new ObjectId(doc.id);
    delete doc.id;
  }
  for (const field of cfg.objectIdFields) {
    if (doc[field] != null) doc[field] = new ObjectId(doc[field]);
  }
  for (const field of cfg.dateFields) {
    if (doc[field] != null) doc[field] = new Date(doc[field]);
  }
  return doc;
}

async function restoreFromDir(dir: string, opts: { confirm: boolean }): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = new MongoClient(url);
  await client.connect();
  const db = client.db();

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "_summary.json");

  try {
    console.log("\nPlanned changes (current count -> backup count):");
    for (const file of files) {
      const fileBase = file.replace(/\.json$/, "");
      const modelName = modelNameFor(fileBase);
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
      const currentCount = await db.collection(modelName).countDocuments();
      console.log(`  ${modelName}: ${currentCount} -> ${raw.length}`);
    }

    if (!opts.confirm) {
      console.log("\nDry run only (no --confirm passed). Nothing was written.");
      return;
    }

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        for (const file of files) {
          const fileBase = file.replace(/\.json$/, "");
          const modelName = modelNameFor(fileBase);
          const cfg = MODEL_CONFIG[modelName];
          if (!cfg) {
            console.warn(`  ${modelName}: SKIPPED (no field-type config)`);
            continue;
          }

          const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
          const docs = raw.map((d: any) => reviveDoc(d, cfg));

          const collection = db.collection(modelName);
          await collection.deleteMany({}, { session });
          if (docs.length > 0) {
            await collection.insertMany(docs, { session });
          }
          console.log(`  ${modelName}: restored ${docs.length} docs`);
        }
      });
      console.log("\nRestore committed.");
    } finally {
      await session.endSession();
    }
  } finally {
    await client.close();
  }
}

async function downloadCheckpointToTempDir(key: string): Promise<string> {
  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("BACKUP_ENCRYPTION_KEY is not set");

  const config = loadR2ConfigFromEnv();
  const client = createR2Client(config);
  const encrypted = await downloadObject(client, config.bucket, key);
  const gzipped = decryptBuffer(encrypted, encryptionKey);
  const bundle = JSON.parse(zlib.gunzipSync(gzipped).toString("utf-8"));

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ksa-restore-"));
  for (const [model, docs] of Object.entries(bundle)) {
    if (model === "_summary") continue;
    fs.writeFileSync(path.join(tempDir, `${model}.json`), JSON.stringify(docs));
  }
  return tempDir;
}

async function listCheckpoints(): Promise<void> {
  const config = loadR2ConfigFromEnv();
  const client = createR2Client(config);
  const objects = await listObjects(client, config.bucket, "db-backups/");
  objects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  if (objects.length === 0) {
    console.log("No checkpoints found in db-backups/.");
    return;
  }
  console.log("Checkpoint\t\t\tSize");
  for (const obj of objects) {
    console.log(`${obj.key}\t${Math.round(obj.size / 1024)} KB`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    await listCheckpoints();
    return;
  }

  const confirm = args.includes("--confirm");
  const keyIndex = args.indexOf("--key");
  const remoteKey = keyIndex >= 0 ? args[keyIndex + 1] : undefined;

  let dir: string;
  let cleanup: (() => void) | undefined;

  if (remoteKey) {
    dir = await downloadCheckpointToTempDir(remoteKey);
    cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  } else {
    const backupsRoot = path.join(process.cwd(), "backups");
    const positional = args.find((a) => !a.startsWith("--") && a !== remoteKey);
    dir = positional
      ? path.join(backupsRoot, positional)
      : path.join(
          backupsRoot,
          fs
            .readdirSync(backupsRoot)
            .filter((d) => fs.statSync(path.join(backupsRoot, d)).isDirectory())
            .sort()
            .at(-1) ?? (() => { throw new Error("No backups found under backups/"); })()
        );
    if (!fs.existsSync(dir)) throw new Error(`Backup directory not found: ${dir}`);
  }

  console.log(`Restoring from: ${remoteKey ?? dir}\n`);
  try {
    await restoreFromDir(dir, { confirm });
  } finally {
    cleanup?.();
  }
}

main().catch((e) => {
  console.error("Restore FAILED:", e);
  process.exit(1);
});
