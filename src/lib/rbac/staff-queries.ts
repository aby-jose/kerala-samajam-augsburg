import { prisma } from "@/lib/prisma";
import type { Permission } from "@/lib/permissions";
import { resolvePermissions } from "./resolve";

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

/**
 * Email addresses of every active Super Admin.
 *
 * Replaces the old `ADMIN_EMAIL` env var as the destination for committee-wide
 * system mail — a failed cron job, a new GDPR erasure request, a gallery
 * contribution to moderate. One hardcoded address meant a wrong or missing
 * value sent notices to nobody, or to the wrong inbox, without anyone
 * noticing; querying the role means every Super Admin hears about it, and
 * onboarding or offboarding one is enough on its own to change who does.
 *
 * `role: "ADMIN"` excludes suspended staff the same way `superAdminCount`
 * does: a suspension rewrites the role to `SUSPENDED_ADMIN`.
 */
export async function superAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", staffRole: { isSystem: true } },
    select: { email: true },
  });

  return admins.map((admin) => admin.email).filter((email): email is string => !!email);
}

/**
 * Email addresses of every active staff member holding `permission`, resolved
 * against the live catalogue exactly as `getStaffContext` does — a Super
 * Admin's role stores no permission keys of its own, so filtering the query
 * on `staffRole.permissions` would silently miss every Super Admin.
 *
 * `role: "ADMIN"` excludes suspended staff the same way `superAdminCount`
 * does: a suspension rewrites the role to `SUSPENDED_ADMIN`.
 */
export async function staffEmailsWithPermission(permission: Permission): Promise<string[]> {
  const staff = await prisma.user.findMany({
    where: { role: "ADMIN", staffRole: { isNot: null } },
    select: { email: true, staffRole: { select: { isSystem: true, permissions: true } } },
  });

  return staff
    .filter((user) => user.staffRole && resolvePermissions(user.staffRole).has(permission))
    .map((user) => user.email)
    .filter((email): email is string => !!email);
}
