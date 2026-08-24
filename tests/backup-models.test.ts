import { describe, expect, it } from "vitest";
import { BACKUP_MODELS, EXCLUDED_MODELS } from "../scripts/lib/backup-models";

describe("backup model scope", () => {
  it("includes exactly the 26 non-sensitive models", () => {
    expect(BACKUP_MODELS).toEqual([
      "config", "aboutContent", "homeContent", "pageContent", "legalDocument",
      "legalRevision", "userConsent", "cookieConsent", "event", "registration",
      "galleryAlbum", "galleryMedia", "faceDetection", "instagramReel",
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
});
