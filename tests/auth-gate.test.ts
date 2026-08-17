import { describe, expect, it } from "vitest";
import { EMAIL_NOT_VERIFIED, SUSPENDED_ERROR, signInBlockReason } from "@/lib/auth-gate";

const VERIFIED = new Date("2026-01-01T00:00:00Z");

describe("sign-in gate", () => {
  it("lets a verified member through", () => {
    expect(signInBlockReason({ role: "MEMBER", emailVerified: VERIFIED })).toBeNull();
  });

  it("blocks a member who has not confirmed their address", () => {
    expect(signInBlockReason({ role: "MEMBER", emailVerified: null })).toBe(EMAIL_NOT_VERIFIED);
  });

  it("lets a verified admin through", () => {
    expect(signInBlockReason({ role: "ADMIN", emailVerified: VERIFIED })).toBeNull();
  });

  it("holds admins to the same rule as members", () => {
    expect(signInBlockReason({ role: "ADMIN", emailVerified: null })).toBe(EMAIL_NOT_VERIFIED);
  });

  it("reports suspension", () => {
    expect(signInBlockReason({ role: "SUSPENDED_MEMBER", emailVerified: VERIFIED })).toBe(
      SUSPENDED_ERROR
    );
  });

  /**
   * Order matters. A suspended member whose address is also unconfirmed would
   * otherwise be sent round the verification loop — email, click, sign in —
   * only to be refused at the end of it for a reason nobody had mentioned.
   */
  it("prefers the suspension message when both apply", () => {
    expect(signInBlockReason({ role: "SUSPENDED_MEMBER", emailVerified: null })).toBe(
      SUSPENDED_ERROR
    );
  });

  it("uses a sentinel for the unverified case, not prose", () => {
    // The login screens match on this value to decide whether to offer a
    // resend, so it must stay a stable code rather than a sentence.
    expect(EMAIL_NOT_VERIFIED).toBe("EMAIL_NOT_VERIFIED");
  });
});
