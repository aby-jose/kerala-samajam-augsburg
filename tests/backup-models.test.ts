import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { BACKUP_MODELS, EXCLUDED_MODELS } from "../scripts/lib/backup-models";

describe("backup model scope", () => {
  it("includes exactly the 27 non-sensitive models", () => {
    expect(BACKUP_MODELS).toEqual([
      "config", "aboutContent", "homeContent", "pageContent", "legalDocument",
      "legalRevision", "userConsent", "cookieConsent", "event", "eventSponsor",
      "registration", "galleryAlbum", "galleryMedia", "faceDetection", "instagramReel",
      "instagramSyncState", "user", "emailLog", "userFaceProfile",
      "membershipPlan", "subscription", "leadershipMember", "mediaContribution",
      "contactMessage", "role", "staffInvite", "auditLog",
    ]);
  });

  it("excludes session/token/rate-limit models", () => {
    expect(EXCLUDED_MODELS).toEqual([
      "account", "session", "verificationToken", "passwordResetToken",
      "captcha", "rateLimit",
    ]);
  });

  it("has no overlap between included and excluded", () => {
    const overlap = BACKUP_MODELS.filter((m) => (EXCLUDED_MODELS as readonly string[]).includes(m));
    expect(overlap).toEqual([]);
  });

  // Drift guard: the two lists above are hand-maintained, so a model added to
  // schema.prisma and forgotten here would silently never be backed up (that
  // is exactly how EventSponsor went missing). Derive the truth from the
  // generated Prisma client instead of restating it.
  it("accounts for every model in the Prisma schema", () => {
    const schemaModels = Object.keys(Prisma.ModelName)
      .map((name) => name.charAt(0).toLowerCase() + name.slice(1))
      .sort();
    const accountedFor = [...BACKUP_MODELS, ...EXCLUDED_MODELS].sort();
    expect(accountedFor).toEqual(schemaModels);
  });

  // scripts/restore-db.ts can't be imported (it runs main() at module load),
  // so read its MODEL_CONFIG keys out of the source text. A backed-up model
  // with no field-type config is skipped at restore time — silently backed up
  // but never restorable.
  it("has a restore-db.ts MODEL_CONFIG entry for every backed-up model", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "scripts", "restore-db.ts"),
      "utf-8"
    );
    const start = source.indexOf("const MODEL_CONFIG");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf("\n};", start);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);
    const configuredModels = [...block.matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]);
    expect(configuredModels.length).toBeGreaterThan(0);

    const missing = BACKUP_MODELS.filter(
      (m) => !configuredModels.includes(m.charAt(0).toUpperCase() + m.slice(1))
    );
    expect(missing).toEqual([]);
  });
});
