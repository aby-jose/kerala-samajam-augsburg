import { describe, expect, it } from "vitest";
import {
  INVITE_TTL_MS,
  hashInviteToken,
  isInviteUsable,
  mintInviteToken,
} from "@/lib/rbac/invite-token";

const now = new Date("2026-08-16T12:00:00Z");
const later = new Date(now.getTime() + INVITE_TTL_MS - 1000);

describe("invite tokens", () => {
  it("mints a 32-character token", () => {
    expect(mintInviteToken()).toHaveLength(32);
  });

  it("mints a different token each time", () => {
    expect(mintInviteToken()).not.toBe(mintInviteToken());
  });

  it("hashes deterministically and irreversibly", () => {
    const raw = "abcdefghijklmnopqrstuvwxyz123456";
    const hash = hashInviteToken(raw);
    expect(hash).toBe(hashInviteToken(raw));
    expect(hash).not.toContain(raw);
    expect(hash).toHaveLength(64);
  });

  it("expires after 72 hours", () => {
    expect(INVITE_TTL_MS).toBe(72 * 60 * 60 * 1000);
  });
});

describe("isInviteUsable", () => {
  const base = { expires: later, acceptedAt: null, revokedAt: null };

  it("accepts a fresh invite", () => {
    expect(isInviteUsable(base, now)).toEqual({ usable: true });
  });

  it("rejects an expired invite", () => {
    const expired = { ...base, expires: new Date(now.getTime() - 1) };
    expect(isInviteUsable(expired, now)).toEqual({ usable: false, reason: "EXPIRED" });
  });

  it("rejects a used invite", () => {
    expect(isInviteUsable({ ...base, acceptedAt: now }, now)).toEqual({
      usable: false,
      reason: "ACCEPTED",
    });
  });

  it("rejects a revoked invite", () => {
    expect(isInviteUsable({ ...base, revokedAt: now }, now)).toEqual({
      usable: false,
      reason: "REVOKED",
    });
  });

  it("rejects a missing invite", () => {
    expect(isInviteUsable(null, now)).toEqual({ usable: false, reason: "NOT_FOUND" });
  });
});
