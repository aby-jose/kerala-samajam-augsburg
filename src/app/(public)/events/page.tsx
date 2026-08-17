import { getPageContent } from "@/lib/page-content/actions";
import type { ListingsContentT } from "@/lib/page-content/listings";
import { EventsClient } from "./events-client";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const content = (await getPageContent("listings")) as ListingsContentT;

  return <EventsClient content={content} />;
}
