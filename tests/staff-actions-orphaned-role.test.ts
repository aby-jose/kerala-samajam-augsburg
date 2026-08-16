import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -------------------------------------------------------------
//
// Covers the two spots in `staff-actions.ts` that read `StaffInvite.role` —
// a required relation — separately from the parent query, specifically so a
// row whose `roleId` no longer resolves (the role was deleted) degrades
// instead of throwing. Prisma throws "Inconsistent query result" for an
// `include` on a required relation that can't resolve; a plain `findMany`/
// `findUnique` on `Role` by id simply omits/returns null for a row that
// doesn't exist, which is what these two functions now rely on. See the
// matching comments in `listStaff` and `resendInvite`.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    role: { findMany: vi.fn(), findUnique: vi.fn() },
    staffInvite: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/guards", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/rbac/audit", () => ({ describeAudit: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendMail: vi.fn(),
  templates: { staff: { invite: vi.fn() } },
  absoluteUrl: (path: string) => `https://example.org${path}`,
}));
vi.mock("@/lib/rate-limit", () => ({ persistentRateLimit: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { sendMail } from "@/lib/email";
import { persistentRateLimit } from "@/lib/rate-limit";
import { listStaff, resendInvite } from "@/lib/staff-actions";

const mockedRequirePermission = vi.mocked(requirePermission);
const mockedFindManyUser = vi.mocked(prisma.user.findMany);
const mockedFindManyRole = vi.mocked(prisma.role.findMany);
const mockedFindUniqueRole = vi.mocked(prisma.role.findUnique);
const mockedFindManyInvite = vi.mocked(prisma.staffInvite.findMany);
const mockedFindUniqueInvite = vi.mocked(prisma.staffInvite.findUnique);
const mockedUpdateInvite = vi.mocked(prisma.staffInvite.update);
const mockedSendMail = vi.mocked(sendMail);
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
});

describe("listStaff — an invite whose role was deleted", () => {
  it("shows a placeholder instead of throwing", async () => {
    // First call is the staff list, second is the inviter lookup — same
    // `prisma.user.findMany` seam used twice, in that order.
    mockedFindManyUser.mockResolvedValueOnce([] as never);
    mockedFindManyInvite.mockResolvedValue([
      {
        id: "invite-1",
        email: "orphan@example.org",
        roleId: "deleted-role",
        invitedById: "inviter-1",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    ] as never);
    // The role `roleId` points to is gone. `findMany` on `Role` just omits
    // it — it does not throw the way an `include` on the required relation
    // would.
    mockedFindManyRole.mockResolvedValue([] as never);
    mockedFindManyUser.mockResolvedValueOnce([
      { id: "inviter-1", email: "inviter@example.org" },
    ] as never);

    const result = await listStaff();

    expect(result.invites).toEqual([
      expect.objectContaining({ id: "invite-1", roleName: "(role deleted)" }),
    ]);
  });

  it("still shows the real role name for an invite whose role exists", async () => {
    mockedFindManyUser.mockResolvedValueOnce([] as never);
    mockedFindManyInvite.mockResolvedValue([
      {
        id: "invite-2",
        email: "fine@example.org",
        roleId: "role-1",
        invitedById: "inviter-1",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    ] as never);
    mockedFindManyRole.mockResolvedValue([{ id: "role-1", name: "Payments Clerk" }] as never);
    mockedFindManyUser.mockResolvedValueOnce([
      { id: "inviter-1", email: "inviter@example.org" },
    ] as never);

    const result = await listStaff();

    expect(result.invites).toEqual([
      expect.objectContaining({ id: "invite-2", roleName: "Payments Clerk" }),
    ]);
  });
});

describe("resendInvite — the role it was issued for no longer exists", () => {
  it("returns a clear error instead of throwing", async () => {
    mockedFindUniqueInvite.mockResolvedValue({
      id: "invite-1",
      email: "orphan@example.org",
      roleId: "deleted-role",
      acceptedAt: null,
    } as never);
    mockedFindUniqueRole.mockResolvedValue(null as never);

    const result = await resendInvite("invite-1");

    expect(result).toEqual({
      error: "The role this invitation was for no longer exists. Revoke it and issue a fresh one.",
    });
    // Nothing else runs once the role is known to be gone: no token minted
    // or written, no mail sent, and the rate-limit budget isn't spent on an
    // invite that can never be fixed by resending.
    expect(mockedUpdateInvite).not.toHaveBeenCalled();
    expect(mockedSendMail).not.toHaveBeenCalled();
    expect(mockedRateLimit).not.toHaveBeenCalled();
  });
});
