import { requirePermissionPage } from "@/lib/guards";
import MembersClient from "./members-client";

export default async function AdminMembersPage() {
  await requirePermissionPage("members.view");

  return <MembersClient />;
}
