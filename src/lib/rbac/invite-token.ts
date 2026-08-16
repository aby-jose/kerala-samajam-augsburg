import { createHash } from "crypto";
import { nanoid } from "nanoid";

/** Long enough for a mailbox to sit on for three days. */
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export function mintInviteToken(): string {
  return nanoid(32);
}

/**
 * Only the hash is stored.
 *
 * An invite grants administrative access, so a read of the collection must not
 * yield working links. Salted with NEXTAUTH_SECRET, matching how consent
 * identifiers are hashed elsewhere.
 */
export function hashInviteToken(raw: string): string {
  const salt = process.env.NEXTAUTH_SECRET || "ksa-invite";
  return createHash("sha256").update(`${salt}:${raw}`).digest("hex");
}

export type InviteRejection = "NOT_FOUND" | "EXPIRED" | "ACCEPTED" | "REVOKED";

export interface UsableInvite {
  expires: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

/**
 * Whether an invite can still be accepted.
 *
 * The caller must collapse every rejection into one generic message before it
 * reaches the browser — distinguishing "expired" from "not found" tells an
 * unauthenticated visitor which addresses have been invited.
 */
export function isInviteUsable(
  invite: UsableInvite | null,
  now: Date
): { usable: true } | { usable: false; reason: InviteRejection } {
  if (!invite) return { usable: false, reason: "NOT_FOUND" };
  if (invite.revokedAt) return { usable: false, reason: "REVOKED" };
  if (invite.acceptedAt) return { usable: false, reason: "ACCEPTED" };
  if (invite.expires <= now) return { usable: false, reason: "EXPIRED" };
  return { usable: true };
}
