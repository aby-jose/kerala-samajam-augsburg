"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, MoveDown, MoveUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cardSurface, panelHeader, tableRow } from "@/components/admin/ui/surface";
import { cn } from "@/lib/utils";
import { setReelFeatured, reorderFeaturedReel, syncReelsNow } from "@/lib/instagram-actions";

interface Reel {
  id: string;
  caption: string | null;
  permalink: string;
  postedAt: Date;
  featured: boolean;
  order: number;
  cloudinaryThumbnailUrl: string | null;
  igThumbnailUrl: string | null;
  cacheError: string | null;
}

const REFRESH_WARNING_DAYS = 14;

export function ReelsManager({
  initialReels,
  lastSyncError,
  tokenExpiresAt,
}: {
  initialReels: Reel[];
  lastSyncError: string | null;
  tokenExpiresAt: Date | null;
}) {
  const { success, error: toastError } = useToast();
  const [reels, setReels] = useState(initialReels);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const featured = reels.filter((r) => r.featured).sort((a, b) => a.order - b.order);
  const rest = reels.filter((r) => !r.featured);

  const tokenWarning =
    tokenExpiresAt &&
    tokenExpiresAt.getTime() - Date.now() <= REFRESH_WARNING_DAYS * 24 * 60 * 60 * 1000;

  function refresh() {
    // Server actions revalidate the route; a client-side reload of props
    // needs a full navigation refresh, same as the Gallery admin's pattern.
    window.location.reload();
  }

  function toggleFeatured(reel: Reel) {
    setBusyId(reel.id);
    startTransition(async () => {
      try {
        await setReelFeatured(reel.id, !reel.featured);
        success(reel.featured ? "Removed from home page." : "Featured on home page.");
        refresh();
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function move(reel: Reel, direction: "up" | "down") {
    setBusyId(reel.id);
    startTransition(async () => {
      try {
        await reorderFeaturedReel(reel.id, direction);
        refresh();
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function syncNow() {
    startTransition(async () => {
      try {
        const result = await syncReelsNow();
        success(`Synced: ${result.created} new, ${result.updated} updated.`);
        refresh();
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Sync failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className={panelHeader}>
        <div>
          <h1 className="font-sans text-lg font-semibold text-foreground">Reels</h1>
          <p className="text-sm text-muted-foreground">
            Feature synced Instagram reels and set their order on the home page.
          </p>
        </div>
        <Button onClick={syncNow} disabled={pending} className="h-9 rounded-lg">
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync now
        </Button>
      </div>

      {(lastSyncError || tokenWarning) && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            {lastSyncError && <p>Last sync failed: {lastSyncError}</p>}
            {tokenWarning && (
              <p>
                The Instagram access token expires soon
                {tokenExpiresAt ? ` (${tokenExpiresAt.toLocaleDateString()})` : ""} — the weekly
                refresh job should catch this automatically before it does.
              </p>
            )}
          </div>
        </div>
      )}

      <div className={cardSurface}>
        <div className={panelHeader}>
          <span className="font-sans text-sm font-semibold text-foreground">
            Featured ({featured.length})
          </span>
        </div>
        <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
          {featured.length === 0 && (
            <p className="p-5 text-sm text-muted-foreground">
              Nothing featured yet — the home section stays hidden until you feature a reel.
            </p>
          )}
          {featured.map((reel, index) => (
            <ReelRow
              key={reel.id}
              reel={reel}
              busy={busyId === reel.id}
              onToggle={() => toggleFeatured(reel)}
              onMoveUp={index > 0 ? () => move(reel, "up") : undefined}
              onMoveDown={index < featured.length - 1 ? () => move(reel, "down") : undefined}
            />
          ))}
        </div>
      </div>

      <div className={cardSurface}>
        <div className={panelHeader}>
          <span className="font-sans text-sm font-semibold text-foreground">
            Synced, not featured ({rest.length})
          </span>
        </div>
        <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
          {rest.length === 0 && (
            <p className="p-5 text-sm text-muted-foreground">Nothing to show.</p>
          )}
          {rest.map((reel) => (
            <ReelRow key={reel.id} reel={reel} busy={busyId === reel.id} onToggle={() => toggleFeatured(reel)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReelRow({
  reel,
  busy,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  reel: Reel;
  busy: boolean;
  onToggle: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const thumb = reel.cloudinaryThumbnailUrl ?? reel.igThumbnailUrl;

  return (
    <div className={cn(tableRow, "flex items-center gap-4 p-4")}>
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {reel.caption || "(no caption)"}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(reel.postedAt).toLocaleDateString()}
          {reel.cacheError && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              Cache failed: {reel.cacheError}
            </span>
          )}
        </p>
      </div>

      {reel.featured && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!onMoveUp || busy}
            onClick={onMoveUp}
            className="h-8 w-8 rounded-md"
            aria-label="Move up"
          >
            <MoveUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!onMoveDown || busy}
            onClick={onMoveDown}
            className="h-8 w-8 rounded-md"
            aria-label="Move down"
          >
            <MoveDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Button
        type="button"
        variant={reel.featured ? "outline" : "default"}
        size="sm"
        disabled={busy}
        onClick={onToggle}
        className="h-8 shrink-0 rounded-lg"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : reel.featured ? "Unfeature" : "Feature"}
      </Button>
    </div>
  );
}
