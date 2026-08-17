import { notFound } from "next/navigation";

import { requirePermissionPage } from "@/lib/guards";
import { PageHeader } from "@/components/admin/ui/page-header";
import { getPageContent } from "@/lib/page-content/actions";
import { isPageSlug, PAGE_CONTENT } from "@/lib/page-content/registry";
import { ContactContentEditor } from "@/components/admin/pages/contact-content-editor";
import type { ContactContentT } from "@/lib/page-content/contact";
import { MembershipContentEditor } from "@/components/admin/pages/membership-content-editor";
import type { MembershipContentT } from "@/lib/page-content/membership";
import { ListingsContentEditor } from "@/components/admin/pages/listings-content-editor";
import type { ListingsContentT } from "@/lib/page-content/listings";

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
      {slug === "membership" && (
        <MembershipContentEditor initialData={content as MembershipContentT} />
      )}
      {slug === "listings" && (
        <ListingsContentEditor initialData={content as ListingsContentT} />
      )}
    </div>
  );
}
