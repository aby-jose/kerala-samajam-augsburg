import { AboutPageClient } from "@/components/layout/about-page-client";
import { getAboutContent } from "@/lib/about-actions";

export default async function AboutPage() {
  const content = await getAboutContent();

  return <AboutPageClient content={content} />;
}
