import { ShieldOff } from "lucide-react";

import { requireStaff } from "@/lib/guards";
import { PageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { cardSurface } from "@/components/admin/ui/surface";

/**
 * Where `requirePermissionPage` sends a signed-in staff member whose role
 * lacks the permission a page requires.
 *
 * Guarded by `requireStaff()` ONLY — never by a specific permission. This
 * page IS the "you don't have that permission" fallback, so gating it
 * behind a permission would let it deny itself: a role missing that one
 * permission would be redirected here, denied again, and redirected here
 * again, forever. Every role that can reach the admin portal at all holds
 * `requireStaff()`'s bar by definition, so this page can never be the thing
 * that traps someone.
 */
export default async function NoAccessPage() {
  const ctx = await requireStaff();

  return (
    <div className="space-y-6">
      <PageHeader title="Access denied" description="Your role doesn't include this page." />

      <section className={cardSurface}>
        <EmptyState
          icon={ShieldOff}
          tone="amber"
          title="You don't have access to this page"
          description={`Your role — ${ctx.roleName} — doesn't include the permission it needs. Ask a Super Admin if you believe this is a mistake.`}
        />
      </section>
    </div>
  );
}
