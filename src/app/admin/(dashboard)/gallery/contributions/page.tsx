import { requirePermissionPage } from "@/lib/guards";
import ContributionsClient from "./contributions-client";

export default async function AdminMediaContributionsPage() {
  await requirePermissionPage("gallery.contributions.view");

  return <ContributionsClient />;
}
