import { requirePermissionPage } from "@/lib/guards";
import InquiriesClient from "./inquiries-client";

export default async function AdminInquiriesPage() {
  await requirePermissionPage("inquiries.view");

  return <InquiriesClient />;
}
