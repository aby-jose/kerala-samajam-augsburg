import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";

import { adminAuthOptions, publicAuthOptions } from "./auth";
import { prisma } from "./prisma";
import type { Permission } from "./permissions";
import { resolvePermissions } from "./rbac/resolve";

/**
 * One place where "is this caller allowed to do this" is decided.
 *
 * Every server action and route handler goes through these helpers rather
 * than hand-rolling its own session check. The per-call-site checks this
 * replaces had drifted badly: some verified the role, most only checked that
 * *a* session existed, and a dozen actions had no check at all.
 *
 * Why the role is never optional
 * ------------------------------
 * There are two independent checks here, and both have to stay.
 *
 * The cookie proves *which portal* the caller came through. That is real now —
 * `auth-tokens.ts` derives each namespace's JWE key with its own salt, so a
 * token minted for one side does not decrypt on the other. It did not used to
 * be: both signed with `NEXTAUTH_SECRET` and next-auth v4 derived the key with
 * an empty salt, so replaying a `ksa-public.session-token` under the name
 * `ksa-admin.session-token` produced a valid admin session.
 *
 * The role proves *what the caller is*. It is read from the database and
 * signed into the token, so it cannot be forged by whoever holds the cookie.
 *
 * Neither substitutes for the other. Dropping the role check would have made
 * the old cookie swap fatal; dropping the cookie check would let an
 * administrator's public-site session drive administration, which is the
 * blast-radius separation the two namespaces exist to provide. Do not weaken
 * either to a truthiness test.
 */

export interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string;
}

function userOf(session: { user?: unknown } | null): SessionUser | null {
  return (session?.user as SessionUser | undefined) ?? null;
}

/** A suspended account keeps a valid token until it expires — reject it here. */
function isSuspended(user: SessionUser | null): boolean {
  return !!user?.role?.startsWith("SUSPENDED_");
}

/**
 * The signed-in administrator, or null.
 *
 * Requires the *admin* session cookie specifically. An administrator is also
 * an ordinary member and may well be signed in through the public login — that
 * is legitimate, and it grants them a public token that carries
 * `role: "ADMIN"`. It does not grant them administration.
 *
 * Accepting the public session here as well would not be a privilege
 * escalation: the role is read from the database and signed into the token, so
 * a member's token says MEMBER and always will. What it *would* do is undo the
 * separation the two token namespaces exist to create — an XSS anywhere on the
 * public site could then drive admin actions with an admin's public session,
 * and the admin panel's own guard (`proxy.ts`) would still have refused to
 * render a single page for that same session. Admin capability is reached
 * through the admin portal or not at all.
 */
export async function getAdminUser(): Promise<SessionUser | null> {
  const user = userOf(await getServerSession(adminAuthOptions));
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

/** Throws unless the caller is an administrator. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getAdminUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/** The signed-in member, or null. Suspended accounts count as signed out. */
export async function getCurrentUser(): Promise<(SessionUser & { id: string }) | null> {
  const user = userOf(await getServerSession(publicAuthOptions));
  if (!user?.id || isSuspended(user)) return null;
  return user as SessionUser & { id: string };
}

/** Throws unless the caller is a signed-in, non-suspended member. */
export async function requireUser(): Promise<SessionUser & { id: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

/**
 * Page-level guard for admin server components.
 *
 * Server components render and stream their payload before any client-side
 * effect runs, so the redirect in the dashboard layout cannot protect the
 * data — by the time it fires, the rows are already on the wire. Pages that
 * read from the database must call this first.
 */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}

/**
 * Either a member or an admin — for actions both use, such as uploading an
 * image. Callers still have to decide what each may do with it.
 */
export async function requireAnyUser(): Promise<SessionUser & { isAdmin: boolean }> {
  const member = await getCurrentUser();
  if (member) return { ...member, isAdmin: member.role === "ADMIN" };

  const admin = await getAdminUser();
  if (admin) return { ...admin, isAdmin: true };

  throw new Error("Not signed in");
}

export interface StaffContext {
  id: string;
  email: string;
  name: string | null;
  roleName: string;
  permissions: ReadonlySet<Permission>;
  has(permission: Permission): boolean;
}

/**
 * The signed-in staff member and their live permission set, or null.
 *
 * The set is read from the database rather than the token on purpose. The role
 * is signed into the JWT and refreshed only every ROLE_REFRESH_INTERVAL_MS, so
 * a token-carried permission list would leave a revoked permission usable for
 * up to five minutes — and would add roughly a kilobyte to every request.
 *
 * `cache()` scopes the lookup to the request, so a page rendering six guarded
 * calls performs one query, not six.
 */
export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const user = await getAdminUser();
  if (!user?.id) return null;

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      staffRole: { select: { name: true, permissions: true, isSystem: true } },
    },
  });

  // Re-checked against the database, not the token: access revoked seconds ago
  // must not survive on the strength of a five-minute-old signature.
  if (!row || row.role !== "ADMIN" || !row.staffRole) return null;

  const permissions = resolvePermissions(row.staffRole);
  return {
    id: row.id,
    email: row.email ?? "",
    name: row.name,
    roleName: row.staffRole.name,
    permissions,
    has: (permission: Permission) => permissions.has(permission),
  };
});

/** Throws unless the caller holds the permission. For server actions. */
export async function requirePermission(permission: Permission): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx || !ctx.has(permission)) throw new Error("Unauthorized");
  return ctx;
}

/** Redirects unless the caller holds the permission. For server components. */
export async function requirePermissionPage(permission: Permission): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/admin/login");
  if (!ctx.has(permission)) redirect("/admin/dashboard");
  return ctx;
}

/** Boolean check for rendering. Never a substitute for the two above. */
export async function can(permission: Permission): Promise<boolean> {
  const ctx = await getStaffContext();
  return ctx?.has(permission) ?? false;
}

/**
 * Any staff member, whatever their role. For the handful of actions where
 * being staff is the whole question — not a shortcut for skipping a check.
 */
export async function requireStaff(): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) throw new Error("Unauthorized");
  return ctx;
}
