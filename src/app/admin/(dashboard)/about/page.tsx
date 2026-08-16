import { requirePermissionPage } from "@/lib/guards";
import { getAboutContent } from "@/lib/about-actions";
import { AboutContentEditor } from "@/components/admin/about-content-editor";

export default async function AdminAboutPage() {
  await requirePermissionPage("content.about.edit");

  const content = await getAboutContent();

  return <AboutContentEditor initialData={content} />;
}
