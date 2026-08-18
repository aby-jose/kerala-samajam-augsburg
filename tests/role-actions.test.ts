import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    role: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn(), create: vi.fn() },
    staffInvite: { count: vi.fn() },
  },
}));

vi.mock("@/lib/guards", () => ({ requirePermission: vi.fn() }));

vi.mock("@/lib/rbac/audit", () => ({ describeAudit: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guards";
import { deleteRole, upsertRole } from "@/lib/role-actions";

const mockedRequirePermission = vi.mocked(requirePermission);
const mockedFindUniqueRole = vi.mocked(prisma.role.findUnique);
const mockedDeleteRole = vi.mocked(prisma.role.delete);
const mockedUpdateRole = vi.mocked(prisma.role.update);
const mockedCreateRole = vi.mocked(prisma.role.create);
const mockedCountInvite = vi.mocked(prisma.staffInvite.count);

const ACTOR = {
  id: "actor-1",
  email: "actor@example.org",
  name: "Actor Actorson",
  roleName: "Super Admin",
  permissions: new Set(),
  has: () => true,
} as never;

/** A staff member scoped to just roles.view + roles.edit — no other grant. */
function roleEditorActor() {
  const held = new Set(["roles.view", "roles.edit"]);
  return {
    id: "actor-1",
    email: "actor@example.org",
    name: "Actor Actorson",
    roleName: "Role Architect",
    permissions: held,
    has: (p: string) => held.has(p),
  } as never;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedRequirePermission.mockResolvedValue(ACTOR);
  mockedUpdateRole.mockResolvedValue({} as never);
  mockedCreateRole.mockResolvedValue({ id: "role-new" } as never);
});

describe("upsertRole — cannot grant a permission the actor doesn't hold", () => {
  const OWN_ROLE = {
    id: "role-1",
    name: "Role Architect",
    isSystem: false,
    permissions: ["roles.view", "roles.edit"],
  };

  it("strips a self-escalating permission from an edit to the actor's own role", async () => {
    mockedRequirePermission.mockResolvedValue(roleEditorActor());
    mockedFindUniqueRole.mockResolvedValue(OWN_ROLE as never);

    const result = await upsertRole({
      id: "role-1",
      name: "Role Architect",
      permissions: ["roles.view", "roles.edit", "staff.manage", "settings.edit"],
    });

    expect(result).toEqual({ success: true });
    expect(mockedUpdateRole).toHaveBeenCalledWith({
      where: { id: "role-1" },
      data: {
        name: "Role Architect",
        description: null,
        permissions: ["roles.view", "roles.edit"],
      },
    });
  });

  it("keeps a permission the role already carried, even if the actor lacks it themself", async () => {
    const roleWithExtra = { ...OWN_ROLE, permissions: [...OWN_ROLE.permissions, "audit.view"] };
    mockedRequirePermission.mockResolvedValue(roleEditorActor());
    mockedFindUniqueRole.mockResolvedValue(roleWithExtra as never);

    await upsertRole({
      id: "role-1",
      name: "Role Architect",
      permissions: ["roles.view", "roles.edit", "audit.view"],
    });

    expect(mockedUpdateRole).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permissions: expect.arrayContaining(["audit.view"]),
        }),
      })
    );
  });

  it("caps a brand-new role's permissions to what the creator already holds", async () => {
    mockedRequirePermission.mockResolvedValue(roleEditorActor());

    await upsertRole({
      name: "New Role",
      permissions: ["roles.view", "roles.edit", "staff.manage"],
    });

    expect(mockedCreateRole).toHaveBeenCalledWith({
      data: {
        name: "New Role",
        description: null,
        permissions: ["roles.view", "roles.edit"],
      },
    });
  });

  it("a Super Admin (holds every permission) can still grant anything", async () => {
    mockedRequirePermission.mockResolvedValue(ACTOR);
    mockedFindUniqueRole.mockResolvedValue(OWN_ROLE as never);

    await upsertRole({
      id: "role-1",
      name: "Role Architect",
      permissions: ["roles.view", "roles.edit", "staff.manage"],
    });

    expect(mockedUpdateRole).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permissions: ["roles.view", "roles.edit", "staff.manage"],
        }),
      })
    );
  });
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
