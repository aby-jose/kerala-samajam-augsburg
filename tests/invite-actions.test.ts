import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bcrypt", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffInvite: { findUnique: vi.fn(), updateMany: vi.fn() },
    user: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/email", () => ({
  sendMail: vi.fn(),
  templates: { account: { passwordChanged: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { hashInviteToken } from "@/lib/rbac/invite-token";
import { acceptInvite, getInviteForToken } from "@/lib/invite-actions";

const mockedFindUniqueInvite = vi.mocked(prisma.staffInvite.findUnique);
const mockedUpdateManyInvite = vi.mocked(prisma.staffInvite.updateMany);
const mockedFindFirstUser = vi.mocked(prisma.user.findFirst);
const mockedUpdateUser = vi.mocked(prisma.user.update);
const mockedCreateUser = vi.mocked(prisma.user.create);
const mockedCreateAuditLog = vi.mocked(prisma.auditLog.create);
const mockedSendMail = vi.mocked(sendMail);

const TOKEN = "test-invite-token-123456789012";
const VALID_PASSWORD = "a-perfectly-fine-password";
const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

function pendingInvite(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "invite-1",
    email: "foo@example.com",
    tokenHash: hashInviteToken(TOKEN),
    roleId: "role-1",
    role: { id: "role-1", name: "Payments Clerk" },
    expires: FUTURE,
    acceptedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedUpdateManyInvite.mockResolvedValue({ count: 1 } as never);
  mockedCreateAuditLog.mockResolvedValue({} as never);
  mockedSendMail.mockResolvedValue({ ok: true } as never);
});

describe("acceptInvite — matches an existing account case-insensitively (I4)", () => {
  it("updates the existing account instead of creating a duplicate", async () => {
    mockedFindUniqueInvite.mockResolvedValue(pendingInvite() as never);
    // The invite was normalised to lower case by inviteStaff, but the real
    // account was registered as "Foo@Example.com" — a different string, same
    // person.
    mockedFindFirstUser.mockResolvedValue({ id: "existing-user-1", name: "Foo" } as never);
    mockedUpdateUser.mockResolvedValue({ id: "existing-user-1", name: "Foo" } as never);

    const result = await acceptInvite(TOKEN, VALID_PASSWORD);

    expect(result).toEqual({ success: true });
    expect(mockedFindFirstUser).toHaveBeenCalledWith({
      where: { email: { equals: "foo@example.com", mode: "insensitive" } },
    });
    expect(mockedUpdateUser).toHaveBeenCalledWith({
      where: { id: "existing-user-1" },
      data: expect.objectContaining({ role: "ADMIN", staffRoleId: "role-1" }),
    });
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("creates a new account only when no case-insensitive match exists", async () => {
    mockedFindUniqueInvite.mockResolvedValue(pendingInvite() as never);
    mockedFindFirstUser.mockResolvedValue(null as never);
    mockedCreateUser.mockResolvedValue({ id: "new-user-1", name: null } as never);

    const result = await acceptInvite(TOKEN, VALID_PASSWORD);

    expect(result).toEqual({ success: true });
    expect(mockedCreateUser).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "foo@example.com", role: "ADMIN" }),
    });
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });
});

describe("getInviteForToken — never 500s on a malformed row (M2)", () => {
  it("returns null instead of throwing when the role relation cannot resolve", async () => {
    // What Prisma does when a required relation (`role`) points at a row
    // that no longer exists — the shape a deleted-role orphan would produce.
    mockedFindUniqueInvite.mockRejectedValue(
      new Error("Inconsistent query result: Field role is required to return data, got `null`")
    );

    await expect(getInviteForToken(TOKEN)).resolves.toBeNull();
  });

  it("still resolves normally for a usable invite", async () => {
    mockedFindUniqueInvite.mockResolvedValue(pendingInvite() as never);

    await expect(getInviteForToken(TOKEN)).resolves.toEqual({
      email: "foo@example.com",
      roleName: "Payments Clerk",
    });
  });
});
