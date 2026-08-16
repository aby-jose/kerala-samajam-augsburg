import { requirePermissionPage } from "@/lib/guards";
import PaymentsClient from "./payments-client";

export default async function AdminPaymentsPage() {
  await requirePermissionPage("payments.view");

  return <PaymentsClient />;
}
