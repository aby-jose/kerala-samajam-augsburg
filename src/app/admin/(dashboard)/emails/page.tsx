import { requirePermissionPage } from "@/lib/guards";
import EmailsClient from "./emails-client";

export default async function AdminEmailsPage() {
  await requirePermissionPage("email.view");

  return <EmailsClient />;
}
