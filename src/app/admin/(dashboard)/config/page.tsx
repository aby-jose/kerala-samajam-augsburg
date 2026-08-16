import { requirePermissionPage } from "@/lib/guards";
import ConfigRedirectClient from "./config-client";

export default async function ConfigPage() {
  await requirePermissionPage("settings.edit");

  return <ConfigRedirectClient />;
}
