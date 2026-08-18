import { getPageContent } from "@/lib/page-content/actions";
import type { ContactContentT } from "@/lib/page-content/contact";
import { ContactClient } from "./contact-client";

export const metadata = {
  title: "Contact Us | Kerala Samajam Augsburg (KSA)",
  description:
    "Get in touch with Kerala Samajam Augsburg (KSA) — questions about membership, events, or joining the Malayali community in Augsburg, Germany.",
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const content = (await getPageContent("contact")) as ContactContentT;

  return <ContactClient content={content} />;
}
