import { getPageContent } from "@/lib/page-content/actions";
import type { EventsContentT } from "@/lib/page-content/events";
import { EventsClient } from "./events-client";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const content = (await getPageContent("events")) as EventsContentT;

  return <EventsClient content={content} />;
}
