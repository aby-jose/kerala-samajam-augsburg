import { describe, expect, it } from "vitest";

import { passwordChanged } from "@/lib/email/templates/account";
import type { MessageContext } from "@/lib/email/shell";

const FAKE_CTX: MessageContext = {
  siteName: "Kerala Samajam",
  contactEmail: "hello@example.org",
  branding: { logoUrl: "", siteName: "Kerala Samajam", primaryColor: "#e11d48" },
  legal: {},
} as never;

describe("passwordChanged — 'Reset my password' action link", () => {
  it("points at the real site root, not the nonexistent /forgot-password", () => {
    // The recipient could be a public member or an admin — `passwordChanged`
    // is sent by both `resetPassword` and `acceptInvite` with no audience
    // flag — so this can't link straight into a token-based reset (that
    // needs a token this email never had) or into the admin-only login
    // route. The home page's header exposes sign-in with a "Forgot
    // password?" option for either audience, and is guaranteed to resolve.
    const doc = passwordChanged(FAKE_CTX, { name: "Alice", changedAt: new Date() });

    expect(doc.close?.button?.href).not.toContain("/forgot-password");
    expect(doc.close?.button?.href).toMatch(/^https:\/\/[^/]+\/$/);
  });
});
