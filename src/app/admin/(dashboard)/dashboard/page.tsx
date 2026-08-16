import { requirePermissionPage } from "@/lib/guards";
import DashboardClient from "./dashboard-client";

export default async function AdminDashboardPage() {
  await requirePermissionPage("dashboard.view");

  return <DashboardClient />;
}
