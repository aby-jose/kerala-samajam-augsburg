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
vi.mock("@/lib/guards", () => ({ requirePermission: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/lib/rbac/audit", () => ({ describeAudit: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendMail: vi.fn(), templates: {} }));
vi.mock("@/lib/config-utils", () => ({ getConfig: vi.fn() }));
vi.mock("@/lib/admin-contact", () => ({ adminEmail: vi.fn(), adminEmailOrNull: vi.fn() }));
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
import { requirePermission } from "@/lib/guards";
import { describeAudit } from "@/lib/rbac/audit";
import { suspendUser, updateMemberDetails } from "@/lib/membership-actions";

const mockedRequirePermission = vi.mocked(requirePermission);
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
