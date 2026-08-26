import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -------------------------------------------------------------
//
// `membership-actions.ts` is a large file with a wide import surface. Only
// `suspendUser` is under test here, so every first-level import is stubbed
// rather than risking a transitive failure (or accidentally exercising code
// belonging to another party's in-flight work) from a module `suspendUser`
// itself never touches.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ publicAuthOptions: {} }));
vi.mock("@/lib/guards", () => ({ requirePermission: vi.fn(), requireUser: vi.fn(), can: vi.fn() }));
vi.mock("@/lib/rbac/audit", () => ({ describeAudit: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendMail: vi.fn(), sendMailBatch: vi.fn(), templates: {} }));
vi.mock("@/lib/config-utils", () => ({ getConfig: vi.fn() }));
vi.mock("@/lib/consent-recorder", () => ({ recordDocumentConsents: vi.fn() }));
vi.mock("@/lib/membership-term", () => ({
  PAYMENT_METHODS: [],
  PENDING_STATUSES: [],
  SUBSCRIPTION_STATUS: {},
  isPaymentMethod: vi.fn(),
  paymentReferenceFor: vi.fn(),
  termEnd: vi.fn(),
}));
vi.mock("@/lib/invoice-actions", () => ({
  sendMembershipPaymentRequest: vi.fn(),
  sendSubscriptionReceipt: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    staffInvite: { updateMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/guards";
import { describeAudit } from "@/lib/rbac/audit";
import { suspendUser, updateMemberDetails } from "@/lib/membership-actions";

const mockedRequirePermission = vi.mocked(requirePermission);
const mockedCan = vi.mocked(can);
const mockedFindUniqueUser = vi.mocked(prisma.user.findUnique);
const mockedUpdateUser = vi.mocked(prisma.user.update);
const mockedCountUser = vi.mocked(prisma.user.count);
const mockedUpdateManyInvite = vi.mocked(prisma.staffInvite.updateMany);
const mockedDescribeAudit = vi.mocked(describeAudit);

const ADMIN = { id: "admin-1", email: "admin@example.org", name: "Admin" } as never;

beforeEach(() => {
  vi.resetAllMocks();
  mockedRequirePermission.mockResolvedValue(ADMIN);
  mockedUpdateManyInvite.mockResolvedValue({ count: 0 } as never);
  mockedUpdateUser.mockResolvedValue({} as never);
  // Only consulted when the target is flagged as a Super Admin (see the
  // lockout describes below), but stubbed for every test so a suspension of
  // an ordinary member never trips over an unmocked prisma call.
  mockedCountUser.mockResolvedValue(2 as never);
  // Defaults to "no" — tests that need the staff.manage holder path opt in
  // explicitly, so a forgotten stub fails closed rather than open.
  mockedCan.mockResolvedValue(false);
});

describe("suspendUser — kills pending invites (Finding 1, suspension side)", () => {
  it("revokes pending invites addressed to the account being suspended", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "alice-1",
      email: "alice@example.org",
      role: "MEMBER",
    } as never);

    await suspendUser("alice-1", "ACTIVE");

    // The exploit this closes: Alice is invited as Super Admin, then
    // suspended for cause while the invite is still live — without this,
    // she could still click the link and clear her own suspension.
    expect(mockedUpdateManyInvite).toHaveBeenCalledWith({
      where: {
        email: { equals: "alice@example.org", mode: "insensitive" },
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("also revokes invites the account had issued, if they were staff", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "staffer-1",
      email: "staffer@example.org",
      role: "ADMIN",
    } as never);

    await suspendUser("staffer-1", "ACTIVE");

    expect(mockedUpdateManyInvite).toHaveBeenCalledWith({
      where: { invitedById: "staffer-1", acceptedAt: null, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("does not touch invites when reinstating, only when suspending", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "bob-1",
      email: "bob@example.org",
      role: "SUSPENDED_MEMBER",
    } as never);

    await suspendUser("bob-1", "SUSPENDED");

    expect(mockedUpdateManyInvite).not.toHaveBeenCalled();
  });

  it("mentions the revoked count in the audit summary", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "carol-1",
      email: "carol@example.org",
      role: "ADMIN",
    } as never);
    mockedUpdateManyInvite.mockResolvedValue({ count: 1 } as never);

    await suspendUser("carol-1", "ACTIVE");

    expect(mockedDescribeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.stringContaining("revoked"),
      })
    );
  });

  it("demotion/suspension itself still succeeds even with nothing to revoke", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "dave-1",
      email: "dave@example.org",
      role: "MEMBER",
    } as never);

    const result = await suspendUser("dave-1", "ACTIVE");

    expect(result).toEqual({ success: true, status: "SUSPENDED" });
    expect(mockedUpdateUser).toHaveBeenCalledWith({
      where: { id: "dave-1" },
      data: { role: "SUSPENDED_MEMBER" },
    });
  });
});

describe("suspendUser — lockout rule 2, the last Super Admin cannot be suspended (Blocker 2)", () => {
  it("refuses to suspend the sole remaining Super Admin", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "super-1",
      email: "super@example.org",
      role: "ADMIN",
      staffRole: { isSystem: true },
    } as never);
    mockedCountUser.mockResolvedValue(1 as never);

    const result = await suspendUser("super-1", "ACTIVE");

    expect(result).toEqual({
      error: "This is the last Super Admin. Promote someone else before changing this account.",
    });
    expect(mockedUpdateUser).not.toHaveBeenCalled();
    expect(mockedUpdateManyInvite).not.toHaveBeenCalled();
  });

  it("allows suspending a Super Admin when another one remains", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "super-2",
      email: "super2@example.org",
      role: "ADMIN",
      staffRole: { isSystem: true },
    } as never);
    mockedCountUser.mockResolvedValue(2 as never);

    const result = await suspendUser("super-2", "ACTIVE");

    expect(result).toEqual({ success: true, status: "SUSPENDED" });
    expect(mockedUpdateUser).toHaveBeenCalled();
  });

  it("does not block reinstating a suspended Super Admin, even if they are the only one", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "super-3",
      email: "super3@example.org",
      role: "SUSPENDED_ADMIN",
      staffRole: { isSystem: true },
    } as never);
    mockedCountUser.mockResolvedValue(1 as never);

    const result = await suspendUser("super-3", "SUSPENDED");

    expect(result).toEqual({ success: true, status: "ACTIVE" });
    expect(mockedUpdateUser).toHaveBeenCalled();
  });
});

describe("updateMemberDetails — cannot write role (Blocker 3)", () => {
  it("silently drops a role field the caller sends, and never touches the database with it", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "target-1",
      email: "target@example.org",
      role: "MEMBER",
    } as never);

    await updateMemberDetails("target-1", { name: "New Name", role: "ADMIN" } as never);

    expect(mockedUpdateUser).toHaveBeenCalledWith({
      where: { id: "target-1" },
      data: { name: "New Name" },
    });
  });

  it("cannot be used to demote the sole Super Admin", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "super-1",
      email: "super@example.org",
      role: "ADMIN",
      staffRole: { isSystem: true },
    } as never);

    await updateMemberDetails("super-1", { role: "MEMBER" } as never);

    const [[call]] = mockedUpdateUser.mock.calls;
    expect(call.data).not.toHaveProperty("role");
  });
});

describe("updateMemberDetails — cannot move a staff member's email without staff.manage (Fix 1)", () => {
  const NEEDS_STAFF_MANAGE = {
    error: "Changing a team member's email address requires the Team management permission.",
  };

  it("refuses a members.edit-only caller changing a Super Admin's email", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "super-1",
      email: "super@example.org",
      role: "ADMIN",
    } as never);
    mockedCan.mockResolvedValue(false);

    const result = await updateMemberDetails("super-1", { email: "attacker@evil.org" });

    expect(result).toEqual(NEEDS_STAFF_MANAGE);
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });

  it("still lets a members.edit-only caller change an ordinary member's email", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "member-1",
      email: "member@example.org",
      role: "MEMBER",
    } as never);
    mockedCan.mockResolvedValue(false);

    const result = await updateMemberDetails("member-1", { email: "member-new@example.org" });

    expect(result).toEqual({ success: true });
    expect(mockedUpdateUser).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { email: "member-new@example.org" },
    });
  });

  it("lets a staff.manage holder change a staff member's email", async () => {
    mockedFindUniqueUser.mockResolvedValue({
      id: "super-2",
      email: "super2@example.org",
      role: "ADMIN",
    } as never);
    mockedCan.mockResolvedValue(true);

    const result = await updateMemberDetails("super-2", { email: "super2-new@example.org" });

    expect(result).toEqual({ success: true });
    expect(mockedUpdateUser).toHaveBeenCalledWith({
      where: { id: "super-2" },
      data: { email: "super2-new@example.org" },
    });
  });

  it("does not block a staff member's own unchanged email from being resubmitted", async () => {
    // Every other field edit on a staff member re-submits the current email
    // along with whatever actually changed. This must keep working for a
    // caller who only holds members.edit.
    mockedFindUniqueUser.mockResolvedValue({
      id: "super-3",
      email: "super3@example.org",
      role: "ADMIN",
    } as never);
    mockedCan.mockResolvedValue(false);

    const result = await updateMemberDetails("super-3", {
      email: "super3@example.org",
      name: "New Name",
    });

    expect(result).toEqual({ success: true });
    expect(mockedUpdateUser).toHaveBeenCalledWith({
      where: { id: "super-3" },
      data: { email: "super3@example.org", name: "New Name" },
    });
  });

  it("treats a suspended admin's email as staff-owned too", async () => {
    // A suspended admin keeps their staffRoleId and can be reinstated later —
    // see suspendUser, which only flips the role prefix. Capturing the email
    // now pays off the moment someone reinstates the account without
    // noticing it was moved.
    mockedFindUniqueUser.mockResolvedValue({
      id: "susp-1",
      email: "susp@example.org",
      role: "SUSPENDED_ADMIN",
    } as never);
    mockedCan.mockResolvedValue(false);

    const result = await updateMemberDetails("susp-1", { email: "attacker@evil.org" });

    expect(result).toEqual(NEEDS_STAFF_MANAGE);
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });
});
