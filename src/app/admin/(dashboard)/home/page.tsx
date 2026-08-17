import { requirePermissionPage } from "@/lib/guards";
import { getHomeContent } from "@/lib/home-actions";
import { HomeContentEditor } from "@/components/admin/home/home-content-editor";

export default async function AdminHomePage() {
  await requirePermissionPage("content.home.edit");

  const content = await getHomeContent();

  return <HomeContentEditor initialData={content} />;
}
