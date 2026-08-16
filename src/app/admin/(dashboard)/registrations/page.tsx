import { requirePermissionPage } from "@/lib/guards";
import RegistrationsClient from "./registrations-client";

export default async function AdminRegistrationsPage() {
  await requirePermissionPage("registrations.view");

  return <RegistrationsClient />;
}
