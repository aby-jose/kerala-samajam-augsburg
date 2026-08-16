"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import { describeAudit } from "./rbac/audit";
import { assertRoleDeletable, assertRoleEditable, LockoutError } from "./rbac/lockout";
import { resolvePermissions } from "./rbac/resolve";
import { isPermission, type Permission } from "./permissions";

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  isSystem: boolean;
  userCount: number;
}

export async function listRoles(): Promise<RoleSummary[]> {
  await requirePermission("roles.view");

  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    // Super Admin's stored array is empty; show what it actually holds.
    permissions: [...resolvePermissions(role)],
    isSystem: role.isSystem,
    userCount: role._count.users,
  }));
}

export async function upsertRole(input: {
  id?: string;
  name: string;
  description?: string;
  permissions: string[];
}) {
  await requirePermission("roles.edit");

  const name = input.name.trim();
  if (!name) return { error: "A role needs a name." };

  // Unknown keys are dropped rather than stored, so a renamed permission
  // cannot linger in a role row and satisfy a future check by accident.
  const permissions = input.permissions.filter(isPermission);

  try {
    if (input.id) {
      const existing = await prisma.role.findUnique({ where: { id: input.id } });
      if (!existing) return { error: "Role not found." };
      assertRoleEditable(existing);

      await prisma.role.update({
        where: { id: input.id },
        data: { name, description: input.description?.trim() || null, permissions },
      });
      await describeAudit({
        summary: `Updated the "${name}" role (${permissions.length} permissions)`,
        entity: "Role",
        entityId: input.id,
        metadata: { permissions },
      });
    } else {
      const created = await prisma.role.create({
        data: { name, description: input.description?.trim() || null, permissions },
      });
      await describeAudit({
        summary: `Created the "${name}" role (${permissions.length} permissions)`,
        entity: "Role",
        entityId: created.id,
        metadata: { permissions },
      });
    }

    revalidatePath("/admin/roles");
    return { success: true };
  } catch (error) {
    if (error instanceof LockoutError) return { error: error.message };
    if ((error as { code?: string }).code === "P2002") {
      return { error: `A role called "${name}" already exists.` };
    }
    console.error("upsertRole failed", error);
    return { error: "Could not save the role." };
  }
}

export async function deleteRole(id: string) {
  await requirePermission("roles.edit");

  try {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) return { error: "Role not found." };

    assertRoleDeletable({ isSystem: role.isSystem, userCount: role._count.users });

    // A pending invite still names this role by id. Deleting the role first
    // would leave that invite's required `role` relation unresolvable —
    // `getInviteForToken` (reached from the unauthenticated accept page)
    // and `listStaff` both fail outright when that happens rather than
    // treating it as an ordinary missing role.
    const pendingInvites = await prisma.staffInvite.count({
      where: { roleId: id, acceptedAt: null, revokedAt: null },
    });
    if (pendingInvites > 0) {
      const invites =
        pendingInvites === 1 ? "1 pending invitation" : `${pendingInvites} pending invitations`;
      return { error: `This role still has ${invites} outstanding. Revoke them first.` };
    }

    await prisma.role.delete({ where: { id } });
    await describeAudit({
      summary: `Deleted the "${role.name}" role`,
      entity: "Role",
      entityId: id,
    });

    revalidatePath("/admin/roles");
    return { success: true };
  } catch (error) {
    if (error instanceof LockoutError) return { error: error.message };
    console.error("deleteRole failed", error);
    return { error: "Could not delete the role." };
  }
}
