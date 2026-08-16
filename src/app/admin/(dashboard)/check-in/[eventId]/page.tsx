import { requirePermissionPage } from "@/lib/guards";
import CheckInClient from "./check-in-client";

export default async function QRScannerPage() {
  await requirePermissionPage("registrations.checkin");

  return <CheckInClient />;
}
