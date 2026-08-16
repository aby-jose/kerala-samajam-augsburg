import { requirePermissionPage } from "@/lib/guards";
import { listRoles } from "@/lib/role-actions";
import { PERMISSIONS, PERMISSION_GROUPS } from "@/lib/permissions";
import { RolesClient } from "./roles-client";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const ctx = await requirePermissionPage("roles.view");
  const roles = await listRoles();

  // The matrix is rendered from the catalogue, so a permission added in code
  // appears here without anyone editing this page.
  const groups = PERMISSION_GROUPS.map((group) => ({
    group,
    permissions: Object.entries(PERMISSIONS)
      .filter(([, meta]) => meta.group === group)
      .map(([key, meta]) => ({ key, label: meta.label, mutates: meta.mutates })),
  })).filter((g) => g.permissions.length > 0);

  return <RolesClient roles={roles} groups={groups} canEdit={ctx.has("roles.edit")} />;
}
