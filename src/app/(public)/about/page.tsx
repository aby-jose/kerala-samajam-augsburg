import { AboutPageClient } from "@/components/layout/about-page-client";
import { getAboutContent } from "@/lib/about-actions";

export const metadata = {
  title: "About Us | Kerala Samajam Augsburg (KSA)",
  description:
    "Kerala Samajam Augsburg (KSA) is the Malayali — Mallu — association in Augsburg, Bavaria — our story, our board, and what we do for the Kerala community here.",
};

export default async function AboutPage() {
  const content = await getAboutContent();

  return <AboutPageClient content={content} />;
}
