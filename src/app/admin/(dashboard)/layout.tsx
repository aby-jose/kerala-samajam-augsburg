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

  return (
    <AdminLayoutClient allowedPermissions={allowedPermissions}>
      {children}
    </AdminLayoutClient>
  );
}
