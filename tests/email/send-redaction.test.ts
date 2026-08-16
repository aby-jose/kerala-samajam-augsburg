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

vi.mock("@/lib/email/layout", () => ({
  // A trivial "shell": just enough structure that the token shows up once
  // (in the action link) and the rest of the message is still recognisable.
  renderEmail: vi.fn(
    (_ctx: unknown, doc: { title: string; action?: string }) =>
      `<html><body><h1>${doc.title}</h1>${doc.action ?? ""}</body></html>`
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

const RAW_TOKEN = "abcXYZ0192838475RAWTOKENvalue";
const INVITE_LINK = `https://example.org/admin/invite/${RAW_TOKEN}`;

describe("sendMail — redactForStorage", () => {
  it("keeps the raw token out of the stored EmailLog.html while still delivering a working link", async () => {
    const result = await sendMail({
      template: "staff.invite",
      to: "invitee@example.org",
      redactForStorage: (html) =>
        html.split(RAW_TOKEN).join("[invite link — token withheld from the stored copy]"),
      build: () => ({
        subject: "You've been invited",
        previewText: "Set up your access.",
        eyebrow: "Invitation",
        title: "Set up your access",
        action: `<a href="${INVITE_LINK}">Set up your access</a>`,
      }),
    });

    expect(result.ok).toBe(true);

    // What was written to the inspectable log.
    const storedHtml = mockedLogCreate.mock.calls[0][0]?.data.html as string;
    // What was actually sent to the invitee.
    const deliveredHtml = mockedDeliver.mock.calls[0][0].html;

    // The credential is gone from storage...
    expect(storedHtml).not.toContain(RAW_TOKEN);
    expect(storedHtml).toContain("[invite link — token withheld from the stored copy]");
    // ...but the rest of the message — subject, heading, structure — survives,
    // so a reviewer can still see what was sent, just not the working link.
    expect(storedHtml).toContain("Set up your access");
    expect(storedHtml).toContain("<html>");

    // The delivered copy is untouched: the invitee's link still works.
    expect(deliveredHtml).toContain(RAW_TOKEN);
    expect(deliveredHtml).toContain(INVITE_LINK);
  });

  it("does not touch storage for templates that don't opt in", async () => {
    await sendMail({
      template: "account.password-changed",
      to: "someone@example.org",
      build: () => ({
        subject: "Your password changed",
        previewText: "Your password changed.",
        eyebrow: "Security",
        title: "Password changed",
        action: `<a href="${INVITE_LINK}">Details</a>`,
      }),
    });

    const storedHtml = mockedLogCreate.mock.calls[0][0]?.data.html as string;
    const deliveredHtml = mockedDeliver.mock.calls[0][0].html;

    // No redaction hook supplied — the two copies are identical, which is
    // the existing behaviour for every template that isn't the invite.
    expect(storedHtml).toBe(deliveredHtml);
    expect(storedHtml).toContain(RAW_TOKEN);
  });
});
