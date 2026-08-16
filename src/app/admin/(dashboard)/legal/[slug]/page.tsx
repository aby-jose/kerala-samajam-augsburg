import { notFound } from "next/navigation";

import { isLegalSlug } from "@/lib/legal-schema";
import { requirePermissionPage } from "@/lib/guards";
import { LegalEditorClient } from "./legal-editor-client";

export default async function AdminLegalEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requirePermissionPage("legal.view");

  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  return <LegalEditorClient slug={slug} />;
}
