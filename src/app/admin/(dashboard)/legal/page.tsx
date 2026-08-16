import { requirePermissionPage } from "@/lib/guards";
import LegalListClient from "./legal-list-client";

export default async function AdminLegalPage() {
  await requirePermissionPage("legal.view");

  return <LegalListClient />;
}
