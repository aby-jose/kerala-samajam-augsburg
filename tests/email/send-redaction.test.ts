import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -------------------------------------------------------------
//
// `sendMail` pulls in the database, site config, the HTML shell and the
// transport — none of which this test cares about. Only two things matter:
// what gets written to `EmailLog.html` and what gets handed to `deliver`.

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/config-utils", () => ({
  getConfig: vi.fn(),
}));

vi.mock("@/lib/email/shell", () => ({
  themed: vi.fn(() => ({})),
  // A trivial shell: just enough structure that the call-to-action link shows
  // up and the rest of the message is still recognisable.
  //
  // The href is emitted **twice** on purpose, mirroring the real `button()` —
  // once inside the MSO-only VML `roundrect`, once as the anchor every other
  // client sees. A redaction that only replaced the first occurrence would
  // leave a live credential in the Outlook fallback, and the assertions below
  // count occurrences to prove it does not.
  renderMessage: vi.fn(
    (
      _ctx: unknown,
      doc: { title: string; close?: { button?: { label: string; href: string } } }
    ) => {
      const b = doc.close?.button;
      const action = b
        ? `<!--[if mso]>` +
          `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${b.href}" style="width:250px;">` +
          `<center>${b.label}</center></v:roundrect>` +
          `<![endif]-->` +
          `<a href="${b.href}">${b.label}</a>`
        : "";
      return `<html><body><h1>${doc.title}</h1>${action}</body></html>`;
    }
  ),
}));

vi.mock("@/lib/email/transport", () => ({
  deliver: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config-utils";
import { deliver } from "@/lib/email/transport";
import { sendMail } from "@/lib/email/send";

const mockedLogCreate = vi.mocked(prisma.emailLog.create);
const mockedLogUpdate = vi.mocked(prisma.emailLog.update);
const mockedGetConfig = vi.mocked(getConfig);
const mockedDeliver = vi.mocked(deliver);

const FAKE_CONFIG = {
  siteName: "Kerala Samajam",
  contactEmail: "hello@example.org",
  branding: { logoUrl: "", siteName: "Kerala Samajam", primaryColor: "#e11d48" },
  legal: {},
  email: {
    fromName: "Kerala Samajam",
    fromEmail: "no-reply@example.org",
    notifications: {},
  },
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetConfig.mockResolvedValue(FAKE_CONFIG);
  mockedLogCreate.mockResolvedValue({ id: "log-1" } as never);
  mockedLogUpdate.mockResolvedValue({} as never);
  mockedDeliver.mockResolvedValue({ ok: true, attempts: 1 } as never);
});

// A realistic nanoid(32) shape — nanoid's default alphabet is
// A-Za-z0-9_-, so nothing here needs URL-encoding once it lands in an href.
const RAW_TOKEN = "V1StGXR8_Z5jdHi6B-myT3xa9bK2pQnW";
const RESET_TOKEN = "Qf7mLp2Xz9RtY0aWc4Vd_e6Ns-8ghJkB";
const VERIFY_TOKEN = "H3nUo1Ck7Ls5Rp0Ta-Yb9Xd_Ge2mVfQz";
const INVITE_LINK = `https://example.org/admin/invite/${RAW_TOKEN}`;

/**
 * The invitation, as the template now builds it.
 *
 * `close.button` is structured — a label and an href — rather than a blob of
 * pre-rendered HTML, so the double-emission that matters here lives in the
 * shell mock above rather than in the fixture.
 */
const inviteMessage = () => ({
  subject: "You've been invited",
  previewText: "Set up your access.",
  eyebrow: "Invitation",
  title: "Set up your access",
  accentWord: "access",
  sections: [],
  close: { button: { label: "Set up your access", href: INVITE_LINK } },
});

describe("sendMail — redactForStorage", () => {
  it("keeps the raw token out of the stored EmailLog.html while still delivering a working link", async () => {
    const result = await sendMail({
      template: "staff.invite",
      to: "invitee@example.org",
      redactForStorage: (html) =>
        html.split(RAW_TOKEN).join("[invite link — token withheld from the stored copy]"),
      build: inviteMessage,
    });

    expect(result.ok).toBe(true);

    // What was written to the inspectable log.
    const storedHtml = mockedLogCreate.mock.calls[0][0]?.data.html as string;
    // What was actually sent to the invitee.
    const deliveredHtml = mockedDeliver.mock.calls[0][0].html;

    // The credential is gone from storage...
    expect(storedHtml).not.toContain(RAW_TOKEN);
    expect(storedHtml).toContain("[invite link — token withheld from the stored copy]");
    // ...both copies of it — the VML fallback and the real anchor — not just
    // the first one a naive single-shot replace would have caught.
    expect(storedHtml.split("[invite link — token withheld from the stored copy]")).toHaveLength(3);
    // ...but the rest of the message — subject, heading, structure — survives,
    // so a reviewer can still see what was sent, just not the working link.
    expect(storedHtml).toContain("Set up your access");
    expect(storedHtml).toContain("<html>");

    // The delivered copy is untouched: the invitee's link still works.
    expect(deliveredHtml).toContain(RAW_TOKEN);
    expect(deliveredHtml).toContain(INVITE_LINK);
    expect(deliveredHtml.split(RAW_TOKEN)).toHaveLength(3); // both occurrences, unredacted
  });

  /**
   * This used to pin the vulnerability: without an explicit opt-in, the raw
   * token landed in storage unredacted. `redactCredentialsForStorage` in
   * `send.ts` now runs unconditionally on every send, so the invite link is
   * stripped here too even though this call never passes `redactForStorage`.
   */
  it("redacts the invite link automatically even for a template that never opts in", async () => {
    await sendMail({
      template: "staff.invite.resend",
      to: "invitee@example.org",
      build: inviteMessage,
    });

    const storedHtml = mockedLogCreate.mock.calls[0][0]?.data.html as string;
    const deliveredHtml = mockedDeliver.mock.calls[0][0].html;

    expect(storedHtml).not.toContain(RAW_TOKEN);
    expect(storedHtml).toContain("[invite link — token withheld from the stored copy]");
    // The delivered copy is still the real thing — only storage changed.
    expect(deliveredHtml).toContain(RAW_TOKEN);
    expect(deliveredHtml).not.toBe(storedHtml);
  });

  it("redacts a `token` query parameter (password reset) automatically", async () => {
    const resetLink = `https://example.org/reset-password?token=${RESET_TOKEN}`;

    await sendMail({
      template: "account.password-reset",
      to: "someone@example.org",
      build: () => ({
        subject: "Reset your password",
        previewText: "A link to set a new password.",
        eyebrow: "Security",
        title: "Set a new password",
        accentWord: "new",
        sections: [],
        close: { button: { label: "Choose a new password", href: resetLink } },
      }),
    });

    const storedHtml = mockedLogCreate.mock.calls[0][0]?.data.html as string;
    const deliveredHtml = mockedDeliver.mock.calls[0][0].html;

    expect(storedHtml).not.toContain(RESET_TOKEN);
    // Where it pointed is still legible — only the credential is gone.
    expect(storedHtml).toContain("/reset-password?token=[link — token withheld from the stored copy]");
    expect(deliveredHtml).toContain(resetLink);
    expect(deliveredHtml).toContain(RESET_TOKEN);
  });

  it("redacts a `token` query parameter (email verification) automatically", async () => {
    const verifyLink = `https://example.org/verify-email?token=${VERIFY_TOKEN}`;

    await sendMail({
      template: "account.verify-email",
      to: "someone@example.org",
      build: () => ({
        subject: "Verify your email",
        previewText: "Confirm your account.",
        eyebrow: "Confirm your account",
        title: "Confirm your email address",
        accentWord: "Confirm",
        sections: [],
        close: { button: { label: "Verify my email", href: verifyLink } },
      }),
    });

    const storedHtml = mockedLogCreate.mock.calls[0][0]?.data.html as string;
    const deliveredHtml = mockedDeliver.mock.calls[0][0].html;

    expect(storedHtml).not.toContain(VERIFY_TOKEN);
    expect(storedHtml).toContain("/verify-email?token=[link — token withheld from the stored copy]");
    expect(deliveredHtml).toContain(verifyLink);
    expect(deliveredHtml).toContain(VERIFY_TOKEN);
  });

  it("does not redact a query parameter that merely contains the word token", async () => {
    const galleryLink = "https://example.org/gallery?tokenCount=3&sort=asc";

    await sendMail({
      // Not one of the templates gated by `NOTIFICATION_TOGGLE`, so this
      // reaches the render/store path unconditionally.
      template: "gallery.link-test",
      to: "someone@example.org",
      build: () => ({
        subject: "Your photo was approved",
        previewText: "It's live in the gallery.",
        eyebrow: "Gallery",
        title: "Your photo is live",
        accentWord: "live",
        sections: [],
        close: { button: { label: "View gallery", href: galleryLink } },
      }),
    });

    const storedHtml = mockedLogCreate.mock.calls[0][0]?.data.html as string;

    // `tokenCount` is not `token` — the whole URL, param name included,
    // survives untouched.
    expect(storedHtml).toContain(galleryLink);
    expect(storedHtml).toContain("tokenCount=3");
  });

  it("keeps custom redactForStorage working alongside the automatic pass, without double-mangling", async () => {
    // Exercises the exact callback `staff-actions.ts` passes today
    // (`redactInviteLink`): a literal split/join on the raw token. Once the
    // automatic pass has already removed that substring, the callback finds
    // nothing left to do — a no-op, not a second, corrupting redaction.
    const result = await sendMail({
      template: "staff.invite",
      to: "invitee@example.org",
      redactForStorage: (html) =>
        html.split(RAW_TOKEN).join("[invite link — token withheld from the stored copy]"),
      build: inviteMessage,
    });

    expect(result.ok).toBe(true);
    const storedHtml = mockedLogCreate.mock.calls[0][0]?.data.html as string;

    // Exactly one clean placeholder per occurrence — not a mangled
    // "[invite link — …][invite link — …]" from the two passes colliding.
    expect(storedHtml).not.toMatch(/\]\s*link|—\]\s*—/);
    expect(storedHtml).toContain(
      `href="https://example.org/admin/invite/[invite link — token withheld from the stored copy]"`
    );
    // The HTML around the link is still well-formed: the anchor and VML tags
    // that wrapped it are intact, not truncated mid-attribute.
    expect(storedHtml).toContain("</a>");
    expect(storedHtml).toContain("</v:roundrect>");
  });

  it("traces the exact value handed to deliver(): the un-redacted render, not the stored copy", async () => {
    await sendMail({
      template: "staff.invite",
      to: "invitee@example.org",
      redactForStorage: (html) =>
        html.split(RAW_TOKEN).join("[invite link — token withheld from the stored copy]"),
      build: inviteMessage,
    });

    const [deliverArgs] = mockedDeliver.mock.calls;
    const [logCreateArgs] = mockedLogCreate.mock.calls;
    const deliveredHtml = deliverArgs[0].html as string;
    const storedHtml = logCreateArgs[0]?.data.html as string;

    // `deliver()` is called with the plain render — the same string that
    // `renderMessage` produced — never the redacted one written to storage.
    expect(deliveredHtml).toContain(INVITE_LINK);
    expect(deliveredHtml).not.toContain("token withheld");
    expect(deliveredHtml).not.toBe(storedHtml);
  });

  it("does not touch the plain-text alternative or the subject — redaction is an EmailLog.html-only boundary", async () => {
    const resetLink = `https://example.org/reset-password?token=${RESET_TOKEN}`;

    await sendMail({
      template: "account.password-reset",
      to: "someone@example.org",
      build: () => ({
        subject: "Reset your password",
        previewText: "A link to set a new password.",
        eyebrow: "Security",
        title: "Set a new password",
        accentWord: "new",
        sections: [],
        close: { button: { label: "Choose a new password", href: resetLink } },
      }),
    });

    const deliverArgs = mockedDeliver.mock.calls[0][0];

    // Subject is never redacted — it never carries the credential to begin
    // with, and only `emailLog.html` is written through the redaction path.
    expect(deliverArgs.subject).toBe("Reset your password");

    // `text` is `htmlToText(html)` derived from the *un-redacted* render (the
    // anchor's href survives as "label (href)"), not from the stored copy.
    expect(deliverArgs.text).toContain(RESET_TOKEN);
    expect(deliverArgs.text).toContain(resetLink);
  });
});
