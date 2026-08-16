import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -------------------------------------------------------------
//
// Only the seams `staff-actions.ts` actually calls are stubbed. Lockout
// rules (`@/lib/rbac/lockout`) and invite tokens (`@/lib/rbac/invite-token`)
// are left real — they are pure and cheap, and using the real thing pins the
// integration rather than assuming it.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    role: { findUnique: vi.fn() },
    staffInvite: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/guards", () => ({ requirePermission: vi.fn() }));

vi.mock("@/lib/rbac/audit", () => ({ describeAudit: vi.fn() }));

vi.mock("@/lib/email", () => ({
  sendMail: vi.fn(),
  templates: {
    staff: {
      invite: vi.fn(),
      accessChanged: vi.fn(),
    },
  },
  absoluteUrl: (path: string) => `https://example.org${path}`,
}));

vi.mock("@/lib/rate-limit", () => ({ persistentRateLimit: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { describeAudit } from "@/lib/rbac/audit";
import { sendMail } from "@/lib/email";
import { persistentRateLimit } from "@/lib/rate-limit";
import {
  changeStaffRole,
  inviteStaff,
  resendInvite,
  revokeStaffAccess,
} from "@/lib/staff-actions";

const mockedRequirePermission = vi.mocked(requirePermission);
const mockedFindUniqueUser = vi.mocked(prisma.user.findUnique);
const mockedFindFirstUser = vi.mocked(prisma.user.findFirst);
const mockedUpdateUser = vi.mocked(prisma.user.update);
const mockedCountUser = vi.mocked(prisma.user.count);
const mockedFindUniqueRole = vi.mocked(prisma.role.findUnique);
const mockedFindFirstInvite = vi.mocked(prisma.staffInvite.findFirst);
const mockedFindUniqueInvite = vi.mocked(prisma.staffInvite.findUnique);
const mockedCreateInvite = vi.mocked(prisma.staffInvite.create);
const mockedUpdateInvite = vi.mocked(prisma.staffInvite.update);
const mockedUpdateManyInvite = vi.mocked(prisma.staffInvite.updateMany);
const mockedSendMail = vi.mocked(sendMail);
const mockedDescribeAudit = vi.mocked(describeAudit);
const mockedRateLimit = vi.mocked(persistentRateLimit);

const ACTOR = {
  id: "actor-1",
  email: "actor@example.org",
  name: "Actor Actorson",
  roleName: "Super Admin",
  permissions: new Set(),
  has: () => true,
} as never;

beforeEach(() => {
  vi.resetAllMocks();
  mockedRequirePermission.mockResolvedValue(ACTOR);
  mockedRateLimit.mockResolvedValue({ ok: true, remaining: 19, resetAt: Date.now() } as never);
  mockedSendMail.mockResolvedValue({ ok: true } as never);
  mockedCountUser.mockResolvedValue(2 as never); // plenty of other Super Admins by default
});

describe("changeStaffRole / revokeStaffAccess — target must actually be staff (I2)", () => {
  const SUSPENDED_MEMBER = {
    id: "target-1",
    name: "Sus Pended",
    email: "sus@example.org",
    role: "SUSPENDED_MEMBER",
    staffRoleId: null,
    staffRole: null,
  };

  it("changeStaffRole refuses a suspended, non-staff target", async () => {
    mockedFindUniqueUser.mockResolvedValue(SUSPENDED_MEMBER as never);

    const result = await changeStaffRole("target-1", "role-2");

    expect(result).toEqual({ error: "That person is not on the staff list." });
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });

  it("revokeStaffAccess refuses a suspended target instead of lifting the suspension", async () => {
    mockedFindUniqueUser.mockResolvedValue(SUSPENDED_MEMBER as never);

    const result = await revokeStaffAccess("target-1");

    expect(result).toEqual({ error: "That person is not on the staff list." });
    // The bug this guards against: nothing previously stopped
    // `role: "MEMBER"` from being written here, which would have cleared
    // the suspension and mailed the person a bogus "access removed" notice.
    expect(mockedUpdateUser).not.toHaveBeenCalled();
    expect(mockedSendMail).not.toHaveBeenCalled();
  });

  it("changeStaffRole still works for an actual staff member", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "target-2",
      name: "Real Staffer",
      email: "staffer@example.org",
      role: "ADMIN",
      staffRoleId: "role-1",
      staffRole: { isSystem: false },
    } as never);
    mockedFindUniqueRole.mockResolvedValue({ id: "role-2", name: "Content Editor" } as never);

    const result = await changeStaffRole("target-2", "role-2");

    expect(result).toEqual({ success: true });
    expect(mockedUpdateUser).toHaveBeenCalledWith({
      where: { id: "target-2" },
      data: { staffRoleId: "role-2" },
    });
  });

  it("revokeStaffAccess still works for an actual staff member", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "target-3",
      name: "Real Staffer",
      email: "staffer@example.org",
      role: "ADMIN",
      staffRoleId: "role-1",
      staffRole: { isSystem: false },
    } as never);
    mockedUpdateManyInvite.mockResolvedValue({ count: 0 } as never);

    const result = await revokeStaffAccess("target-3");

    expect(result).toEqual({ success: true });
    expect(mockedUpdateUser).toHaveBeenCalledWith({
      where: { id: "target-3" },
      data: { role: "MEMBER", staffRoleId: null },
    });
  });
});

describe("revokeStaffAccess — burns the target's own pending invites (I3)", () => {
  it("revokes outstanding invites the removed admin had sent, and mentions the count", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "target-4",
      name: "Departing Admin",
      email: "departing@example.org",
      role: "ADMIN",
      staffRoleId: "role-1",
      staffRole: { isSystem: false },
    } as never);
    mockedUpdateManyInvite.mockResolvedValue({ count: 2 } as never);

    await revokeStaffAccess("target-4");

    expect(mockedUpdateManyInvite).toHaveBeenCalledWith({
      where: { invitedById: "target-4", acceptedAt: null, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockedDescribeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.stringContaining("2 pending invitations"),
      })
    );
  });

  it("says nothing extra when there was nothing pending to revoke", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "target-5",
      name: "Departing Admin",
      email: "departing@example.org",
      role: "ADMIN",
      staffRoleId: "role-1",
      staffRole: { isSystem: false },
    } as never);
    mockedUpdateManyInvite.mockResolvedValue({ count: 0 } as never);

    await revokeStaffAccess("target-5");

    expect(mockedDescribeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: "Removed departing@example.org's admin access",
      })
    );
  });
});

describe("inviteStaff — refuses a suspended address (I5)", () => {
  it("does not invite an address whose account is suspended", async () => {
    mockedFindUniqueRole.mockResolvedValue({ id: "role-1", name: "Payments Clerk" } as never);
    mockedFindFirstUser.mockResolvedValue({
      id: "user-1",
      role: "SUSPENDED_ADMIN",
      staffRoleId: null,
    } as never);

    const result = await inviteStaff("suspended@example.org", "role-1");

    expect(result).toEqual({
      error: "This person's account is suspended. Lift the suspension before inviting them.",
    });
    expect(mockedCreateInvite).not.toHaveBeenCalled();
  });
});

describe("inviteStaff — case-insensitive account matching (I4)", () => {
  it("looks up an existing account case-insensitively", async () => {
    mockedFindUniqueRole.mockResolvedValue({ id: "role-1", name: "Payments Clerk" } as never);
    mockedFindFirstUser.mockResolvedValue({
      id: "user-1",
      role: "MEMBER",
      staffRoleId: null,
    } as never);
    mockedFindFirstInvite.mockResolvedValue(null as never);

    const result = await inviteStaff("Foo@Example.com", "role-1");

    expect(result).toEqual({ success: true });
    expect(mockedFindFirstUser).toHaveBeenCalledWith({
      where: { email: { equals: "foo@example.com", mode: "insensitive" } },
      select: { id: true, role: true, staffRoleId: true },
    });
  });
});

describe("resendInvite — rate limited like inviteStaff (I6)", () => {
  const PENDING_INVITE = {
    id: "invite-1",
    email: "invitee@example.org",
    acceptedAt: null,
    role: { name: "Payments Clerk" },
  };

  it("shares inviteStaff's per-actor budget", async () => {
    mockedFindUniqueInvite.mockResolvedValue(PENDING_INVITE as never);
    mockedFindFirstUser.mockResolvedValue(null as never);

    await resendInvite("invite-1");

    expect(mockedRateLimit).toHaveBeenCalledWith("invite:actor-1", 20, 60 * 60 * 1000);
  });

  it("refuses to resend once the budget is exhausted", async () => {
    mockedFindUniqueInvite.mockResolvedValue(PENDING_INVITE as never);
    mockedRateLimit.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() } as never);

    const result = await resendInvite("invite-1");

    expect(result).toEqual({ error: "Too many invitations sent. Try again in an hour." });
    expect(mockedUpdateInvite).not.toHaveBeenCalled();
  });
});
