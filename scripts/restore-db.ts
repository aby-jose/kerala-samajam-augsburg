/**
 * Restores the database from a JSON backup produced by scripts/backup-db.ts.
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
 * Usage: npx tsx scripts/restore-db.ts <backup-dir-name>
 *   e.g.  npx tsx scripts/restore-db.ts 20260818-134452
 * Defaults to the most recent backup under backups/ if omitted.
 */
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import fs from "fs";
import path from "path";

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

async function main() {
  const backupsRoot = path.join(process.cwd(), "backups");
  const requested = process.argv[2];
  const dir = requested
    ? path.join(backupsRoot, requested)
    : path.join(
        backupsRoot,
        fs
          .readdirSync(backupsRoot)
          .filter((d) => fs.statSync(path.join(backupsRoot, d)).isDirectory())
          .sort()
          .at(-1) ?? (() => { throw new Error("No backups found under backups/"); })()
      );

  if (!fs.existsSync(dir)) {
    throw new Error(`Backup directory not found: ${dir}`);
  }
  console.log(`Restoring from: ${dir}\n`);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = new MongoClient(url);
  await client.connect();
  const db = client.db(); // uses the db name embedded in the connection string

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "_summary.json");

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
    await client.close();
  }
}

main().catch((e) => {
  console.error("Restore FAILED (transaction rolled back):", e);
  process.exit(1);
});
