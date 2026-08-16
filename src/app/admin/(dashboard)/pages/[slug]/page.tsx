import { notFound } from "next/navigation";

import { requirePermissionPage } from "@/lib/guards";
import { PageHeader } from "@/components/admin/ui/page-header";
import { getPageContent } from "@/lib/page-content/actions";
import { isPageSlug, PAGE_CONTENT } from "@/lib/page-content/registry";
import { ContactContentEditor } from "@/components/admin/pages/contact-content-editor";
import type { ContactContentT } from "@/lib/page-content/contact";

export default async function AdminPageContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requirePermissionPage("content.pages.edit");

  const { slug } = await params;
  if (!isPageSlug(slug)) notFound();

  const content = await getPageContent(slug);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${PAGE_CONTENT[slug].label} page`}
        description="Edit the wording shown to visitors. Changes appear immediately."
      />
      {slug === "contact" && (
        <ContactContentEditor initialData={content as ContactContentT} />
      )}
    </div>
  );
}
