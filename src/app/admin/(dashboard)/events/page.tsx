import { requirePermissionPage } from "@/lib/guards";
import EventsClient from "./events-client";

export default async function AdminEventsPage() {
  await requirePermissionPage("events.view");

  return <EventsClient />;
}
