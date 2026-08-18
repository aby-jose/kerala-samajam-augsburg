import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bcrypt", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn() },
    passwordResetToken: { findUnique: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/email", () => ({
  absoluteUrl: (path: string) => `https://example.org${path}`,
  sendMail: vi.fn(),
  templates: { account: { passwordChanged: vi.fn(), passwordReset: vi.fn() } },
}));

vi.mock("@/lib/consent-recorder", () => ({ recordDocumentConsents: vi.fn() }));
vi.mock("@/lib/captcha", () => ({ verifyCaptcha: vi.fn(), generateCaptcha: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ persistentRateLimit: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { persistentRateLimit } from "@/lib/rate-limit";
import { resetPassword } from "@/lib/auth-actions";

const mockedFindUniqueToken = vi.mocked(prisma.passwordResetToken.findUnique);
const mockedDeleteManyToken = vi.mocked(prisma.passwordResetToken.deleteMany);
const mockedUpdateUser = vi.mocked(prisma.user.update);
const mockedSendMail = vi.mocked(sendMail);
const mockedRateLimit = vi.mocked(persistentRateLimit);

const TOKEN = "a-valid-reset-token";
const NEW_PASSWORD = "a-perfectly-fine-new-password";
const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

beforeEach(() => {
  vi.resetAllMocks();
  mockedRateLimit.mockResolvedValue({ ok: true, remaining: 2, resetAt: 0 });
  mockedDeleteManyToken.mockResolvedValue({ count: 1 } as never);
  mockedSendMail.mockResolvedValue({ ok: true } as never);
});

describe("resetPassword — reports the account's role so the caller can route back to the right portal", () => {
  it("returns role: ADMIN for an admin account", async () => {
    mockedFindUniqueToken.mockResolvedValue({
      email: "admin@example.com",
      token: TOKEN,
      expires: FUTURE,
    } as never);
    mockedUpdateUser.mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
    } as never);

    const result = await resetPassword(TOKEN, NEW_PASSWORD);

    expect(result).toEqual({ success: true, role: "ADMIN" });
  });

  it("returns role: MEMBER for a member account", async () => {
    mockedFindUniqueToken.mockResolvedValue({
      email: "member@example.com",
      token: TOKEN,
      expires: FUTURE,
    } as never);
    mockedUpdateUser.mockResolvedValue({
      id: "user-2",
      email: "member@example.com",
      name: "Member",
      role: "MEMBER",
    } as never);

    const result = await resetPassword(TOKEN, NEW_PASSWORD);

    expect(result).toEqual({ success: true, role: "MEMBER" });
  });
});
