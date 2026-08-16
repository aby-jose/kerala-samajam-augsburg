import { requirePermissionPage } from "@/lib/guards";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  await requirePermissionPage("settings.edit");

  return <SettingsClient />;
}
