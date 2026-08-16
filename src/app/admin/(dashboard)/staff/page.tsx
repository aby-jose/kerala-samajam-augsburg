import { requirePermissionPage } from "@/lib/guards";
import { listStaff } from "@/lib/staff-actions";
import { listRoles } from "@/lib/role-actions";
import { StaffClient } from "./staff-client";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const ctx = await requirePermissionPage("staff.view");

  const { staff, invites } = await listStaff();
  // Guarded by roles.view, which staff.view does not imply. Without a role
  // list there is nothing to invite someone *into*, so the form hides itself.
  const roles = ctx.has("roles.view") ? await listRoles() : [];

  return (
    <StaffClient
      staff={staff}
      invites={invites}
      roles={roles.map((r) => ({ id: r.id, name: r.name }))}
      currentUserId={ctx.id}
      canInvite={ctx.has("staff.invite") && roles.length > 0}
      canManage={ctx.has("staff.manage") && roles.length > 0}
    />
  );
}
