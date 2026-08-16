import { beforeEach, describe, expect, it, vi } from "vitest";

// `resendEmail` re-delivers `EmailLog.html` byte-for-byte (see the docstring
// on the action itself). Since every send now redacts credential links out
// of the stored copy (`redactCredentialsForStorage` in `email/send.ts`), a
// resend of a redacted body would mail a dead link while reporting success.
// `wasRedactedForStorage` is pulled from the *real* module rather than
// stubbed, so this test is pinned to the actual placeholder text, not a
// re-typed copy of it that could drift out of sync.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/guards", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/config-utils", () => ({ getConfig: vi.fn() }));
vi.mock("@/lib/email-constants", () => ({ EMAIL_LOG_PAGE_SIZE: 20 }));

vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    buildFrom: vi.fn(() => '"Kerala Samajam" <noreply@example.org>'),
    deliver: vi.fn(),
    sendMail: vi.fn(),
    templates: {},
    transportStatus: vi.fn(() => ({ resend: true, smtp: false })),
    wasRedactedForStorage: actual.wasRedactedForStorage,
  };
});

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { getConfig } from "@/lib/config-utils";
import { deliver } from "@/lib/email";
import { resendEmail } from "@/lib/email-admin-actions";

const mockedFindUniqueLog = vi.mocked(prisma.emailLog.findUnique);
const mockedCreateLog = vi.mocked(prisma.emailLog.create);
const mockedUpdateLog = vi.mocked(prisma.emailLog.update);
const mockedRequirePermission = vi.mocked(requirePermission);
const mockedGetConfig = vi.mocked(getConfig);
const mockedDeliver = vi.mocked(deliver);

const ADMIN = { id: "admin-1", email: "admin@example.org", name: "Admin" } as never;

beforeEach(() => {
  vi.resetAllMocks();
  mockedRequirePermission.mockResolvedValue(ADMIN);
  mockedGetConfig.mockResolvedValue({
    contactEmail: "hello@example.org",
    email: { fromName: "KSA", fromEmail: "noreply@example.org" },
    siteName: "Kerala Samajam",
  } as never);
  mockedCreateLog.mockResolvedValue({ id: "log-new" } as never);
  mockedUpdateLog.mockResolvedValue({} as never);
  mockedDeliver.mockResolvedValue({
    ok: true,
    provider: "resend",
    providerId: "p1",
    attempts: 1,
  } as never);
});

describe("resendEmail — refuses a redacted body (Important 4)", () => {
  it("refuses a password-reset body whose token was redacted for storage", async () => {
    mockedFindUniqueLog.mockResolvedValue({
      id: "log-1",
      template: "account.password-reset",
      to: "member@example.org",
      subject: "Reset your password",
      entityId: null,
      html: `<a href="https://example.org/reset-password?token=[link — token withheld from the stored copy]">Reset</a>`,
    } as never);

    await expect(resendEmail("log-1")).rejects.toThrow(/cannot be resent/i);

    expect(mockedCreateLog).not.toHaveBeenCalled();
    expect(mockedDeliver).not.toHaveBeenCalled();
  });

  it("refuses a staff-invite body whose link was redacted for storage", async () => {
    mockedFindUniqueLog.mockResolvedValue({
      id: "log-2",
      template: "staff.invite",
      to: "invitee@example.org",
      subject: "You're invited",
      entityId: null,
      html: `<a href="https://example.org/admin/invite/[invite link — token withheld from the stored copy]">Accept</a>`,
    } as never);

    await expect(resendEmail("log-2")).rejects.toThrow(/cannot be resent/i);

    expect(mockedCreateLog).not.toHaveBeenCalled();
    expect(mockedDeliver).not.toHaveBeenCalled();
  });

  it("still resends an ordinary body with no redaction placeholder", async () => {
    mockedFindUniqueLog.mockResolvedValue({
      id: "log-3",
      template: "event.ticket",
      to: "member@example.org",
      subject: "Your ticket",
      entityId: "event-1",
      html: `<p>See you at the picnic!</p>`,
    } as never);

    const result = await resendEmail("log-3");

    expect(result).toEqual({ success: true });
    expect(mockedDeliver).toHaveBeenCalled();
    expect(mockedCreateLog).toHaveBeenCalled();
  });

  it("still refuses when there is no stored body at all (pre-existing behaviour)", async () => {
    mockedFindUniqueLog.mockResolvedValue({
      id: "log-4",
      template: "event.ticket",
      to: "member@example.org",
      subject: "Your ticket",
      entityId: "event-1",
      html: null,
    } as never);

    await expect(resendEmail("log-4")).rejects.toThrow(/no longer stored/i);
  });
});
