import { requireStaff } from "@/lib/guards";
import { PageHeader } from "@/components/admin/ui/page-header";
import { ProfileCard } from "./profile-card";
import { AccountForm } from "./account-form";

/**
 * Guarded by `requireStaff()` only, not a specific permission — changing
 * your own password is "is this person staff at all", the same question
 * `/admin/no-access` answers, not "does their role include this feature".
 */
export default async function AccountPage() {
  const ctx = await requireStaff();

  return (
    <div className="space-y-6">
      <PageHeader title="My account" description="Your profile, photo and sign-in password." />
      <ProfileCard email={ctx.email} name={ctx.name} roleName={ctx.roleName} image={ctx.image} />
      <AccountForm />
    </div>
  );
}
