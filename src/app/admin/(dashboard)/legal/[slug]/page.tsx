import { notFound } from "next/navigation";

import { isLegalSlug } from "@/lib/legal-schema";
import { LegalEditorClient } from "./legal-editor-client";

export default async function AdminLegalEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  return <LegalEditorClient slug={slug} />;
}
