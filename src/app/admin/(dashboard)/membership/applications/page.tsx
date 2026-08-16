import { requirePermissionPage } from "@/lib/guards";
import ApplicationsClient from "./applications-client";

export default async function AdminApplicationsPage() {
  await requirePermissionPage("membership.applications.view");

  return <ApplicationsClient />;
}
