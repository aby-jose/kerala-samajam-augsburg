import { getPageContent } from "@/lib/page-content/actions";
import type { ContactContentT } from "@/lib/page-content/contact";
import { ContactClient } from "./contact-client";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const content = (await getPageContent("contact")) as ContactContentT;

  return <ContactClient content={content} />;
}
