import { requirePermissionPage } from "@/lib/guards";
import ConsentsClient from "./consents-client";

export default async function ConsentLogPage() {
  await requirePermissionPage("legal.consents.view");

  return <ConsentsClient />;
}
