import { prisma } from "@/lib/prisma";

/**
 * Counts the holders of the system role, used by the last-Super-Admin rule
 * (spec §10.2, rule 2). Shared by every action that can demote, revoke or
 * suspend a staff member, so the count is computed exactly one way.
 */
export async function superAdminCount(): Promise<number> {
  return prisma.user.count({
    where: { role: "ADMIN", staffRole: { isSystem: true } },
  });
}
