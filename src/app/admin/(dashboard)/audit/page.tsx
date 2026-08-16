import { requirePermissionPage } from "@/lib/guards";
import { getAuditLog } from "@/lib/audit-actions";
import { PERMISSIONS } from "@/lib/permissions";
import AuditClient from "./audit-client";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePermissionPage("audit.view");

  const initial = await getAuditLog();

  // Only mutating permissions ever appear as an entry's `action` — see
  // guards.ts, which logs on `PERMISSIONS[permission].mutates`. Listing the
  // read-only keys too would just be filter options that can never match.
  const actionOptions = Object.entries(PERMISSIONS)
    .filter(([, meta]) => meta.mutates)
    .map(([key, meta]) => ({ key, label: meta.label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return <AuditClient initial={initial} actionOptions={actionOptions} />;
}
