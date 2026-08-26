import { getStaffContext } from "@/lib/guards";
import AdminLayoutClient from "./layout-client";

/**
 * Server parent for the dashboard shell. `getStaffContext` needs the request
 * (session, database), which client components cannot reach, so the
 * permission set is resolved here and handed down as a plain array.
 *
 * This filtering is cosmetic only — every admin page still enforces its own
 * permission via `requirePermissionPage`. A signed-out caller, or one whose
 * staff role was revoked mid-session, simply gets an empty list: no nav item
 * renders, and the page guard on whatever route they land on redirects them.
 * `getStaffContext` is wrapped in React `cache()`, so this costs no extra
 * query beyond what the page itself already pays.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getStaffContext();
  const allowedPermissions = ctx ? [...ctx.permissions] : [];

  // Read fresh off the database, same as the account page itself — not off
  // the client-side session, which never carried `image`/`roleName` and only
  // refreshes its `name`/`email` when the JWT itself is reissued. Sourcing
  // both from here means a photo (or name) update shows up in the topbar as
  // soon as the layout re-renders, instead of waiting on a fresh sign-in.
  const user = ctx
    ? { name: ctx.name, email: ctx.email, image: ctx.image, roleName: ctx.roleName }
    : null;

  return (
    <AdminLayoutClient allowedPermissions={allowedPermissions} user={user}>
      {children}
    </AdminLayoutClient>
  );
}
