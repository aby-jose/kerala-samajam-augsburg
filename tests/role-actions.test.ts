import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    role: { findUnique: vi.fn(), delete: vi.fn() },
    staffInvite: { count: vi.fn() },
  },
}));

vi.mock("@/lib/guards", () => ({ requirePermission: vi.fn() }));

vi.mock("@/lib/rbac/audit", () => ({ describeAudit: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { deleteRole } from "@/lib/role-actions";

const mockedRequirePermission = vi.mocked(requirePermission);
const mockedFindUniqueRole = vi.mocked(prisma.role.findUnique);
const mockedDeleteRole = vi.mocked(prisma.role.delete);
const mockedCountInvite = vi.mocked(prisma.staffInvite.count);

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

describe("deleteRole — refuses a role with pending invites (M2)", () => {
  const ORDINARY_ROLE = {
    id: "role-1",
    name: "Content Editor",
    isSystem: false,
    _count: { users: 0 },
  };

  it("blocks deletion while an invite still names this role", async () => {
    mockedFindUniqueRole.mockResolvedValue(ORDINARY_ROLE as never);
    mockedCountInvite.mockResolvedValue(1 as never);

    const result = await deleteRole("role-1");

    expect(result).toEqual({
      error: "This role still has 1 pending invitation outstanding. Revoke them first.",
    });
    expect(mockedDeleteRole).not.toHaveBeenCalled();
  });

  it("pluralises the count for more than one outstanding invite", async () => {
    mockedFindUniqueRole.mockResolvedValue(ORDINARY_ROLE as never);
    mockedCountInvite.mockResolvedValue(3 as never);

    const result = await deleteRole("role-1");

    expect(result).toEqual({
      error: "This role still has 3 pending invitations outstanding. Revoke them first.",
    });
  });

  it("only counts unresolved invites, so an accepted or revoked one does not block deletion", async () => {
    mockedFindUniqueRole.mockResolvedValue(ORDINARY_ROLE as never);
    mockedCountInvite.mockResolvedValue(0 as never);

    const result = await deleteRole("role-1");

    expect(result).toEqual({ success: true });
    expect(mockedCountInvite).toHaveBeenCalledWith({
      where: { roleId: "role-1", acceptedAt: null, revokedAt: null },
    });
    expect(mockedDeleteRole).toHaveBeenCalledWith({ where: { id: "role-1" } });
  });
});
