/**
 * Which Prisma models get captured in a database backup.
 *
 * Excluded models are short-lived or security-sensitive: restoring a stale
 * session or password-reset token later is meaningless (it's expired by
 * then), and including live tokens in an off-site archive is pure added
 * exposure with no recovery benefit. `user` (bcrypt password hashes) stays
 * in — hashes are one-way and the account records are genuinely needed to
 * restore who the members are.
 */
export const BACKUP_MODELS = [
  "config", "aboutContent", "homeContent", "pageContent", "legalDocument",
  "legalRevision", "userConsent", "cookieConsent", "event", "registration",
  "galleryAlbum", "galleryMedia", "faceDetection", "instagramReel",
  "instagramSyncState", "user", "emailLog", "userFaceProfile",
  "membershipPlan", "subscription", "leadershipMember", "mediaContribution",
  "contactMessage", "role", "staffInvite", "auditLog",
] as const;

export const EXCLUDED_MODELS = [
  "account", "session", "verificationToken", "passwordResetToken",
  "captcha", "rateLimit",
] as const;
