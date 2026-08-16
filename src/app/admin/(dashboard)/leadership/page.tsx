import { requirePermissionPage } from "@/lib/guards";
import LeadershipClient from "./leadership-client";

export default async function AdminLeadershipPage() {
  await requirePermissionPage("content.leadership.edit");

  return <LeadershipClient />;
}
