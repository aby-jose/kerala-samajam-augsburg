import { notFound } from "next/navigation";

import { isLegalSlug } from "@/lib/legal-schema";
import { requirePermissionPage } from "@/lib/guards";
import { LegalEditorClient } from "./legal-editor-client";

export default async function AdminLegalEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const ctx = await requirePermissionPage("legal.view");

  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  // legal.view only guarantees read access — saving needs legal.edit and
  // publishing/taking-offline needs legal.publish (see legal-actions.ts).
  // Passed down so the client can disable those controls up front instead
  // of letting someone type changes and only discover they can't save.
  return (
    <LegalEditorClient
      slug={slug}
      canEdit={ctx.has("legal.edit")}
      canPublish={ctx.has("legal.publish")}
    />
  );
}
