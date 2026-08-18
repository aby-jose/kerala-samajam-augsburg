import { requirePermissionPage } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ReelsManager } from "@/components/admin/reels/reels-manager";

export default async function AdminReelsPage() {
  await requirePermissionPage("reels.view");

  const [reels, syncState] = await Promise.all([
    prisma.instagramReel.findMany({
      orderBy: [{ featured: "desc" }, { order: "asc" }, { postedAt: "desc" }],
    }),
    prisma.instagramSyncState.findUnique({ where: { key: "current" } }),
  ]);

  return (
    <ReelsManager
      initialReels={reels}
      lastSyncError={syncState?.lastSyncError ?? null}
      lastTokenRefreshError={syncState?.lastTokenRefreshError ?? null}
      tokenExpiresAt={syncState?.tokenExpiresAt ?? null}
    />
  );
}
