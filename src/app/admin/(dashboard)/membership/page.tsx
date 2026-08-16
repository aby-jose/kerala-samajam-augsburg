import { requirePermissionPage } from "@/lib/guards";
import MembershipClient from "./membership-client";

export default async function AdminMembershipPage() {
  await requirePermissionPage("membership.plans.view");

  return <MembershipClient />;
}
