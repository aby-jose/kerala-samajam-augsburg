import { requirePermissionPage } from "@/lib/guards";
import AnalyticsClient from "./analytics-client";

export default async function AnalyticsPage() {
  await requirePermissionPage("analytics.view");

  return <AnalyticsClient />;
}
