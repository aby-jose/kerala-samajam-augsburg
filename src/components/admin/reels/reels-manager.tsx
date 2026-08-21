"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, MoveDown, MoveUp, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cardSurface, panelHeader, tableRow } from "@/components/admin/ui/surface";
import { cn } from "@/lib/utils";
import {
  setReelFeatured,
  reorderFeaturedReel,
  syncReelsNow,
  uploadReelVideo,
} from "@/lib/instagram-actions";

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
  lastTokenRefreshError,
  tokenExpiresAt,
}: {
  initialReels: Reel[];
  lastSyncError: string | null;
  lastTokenRefreshError: string | null;
  tokenExpiresAt: Date | null;
}) {
  const { success, error: toastError } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // No local copy of the list: initialReels is re-fetched fresh whenever
  // router.refresh() re-renders this page's server component, so it's
  // already the single source of truth — a useState mirror of it would just
  // go stale (state doesn't resync from a changed initializer prop).
  const featured = initialReels.filter((r) => r.featured).sort((a, b) => a.order - b.order);
  const rest = initialReels.filter((r) => !r.featured);

  const tokenWarning =
    tokenExpiresAt &&
    tokenExpiresAt.getTime() - Date.now() <= REFRESH_WARNING_DAYS * 24 * 60 * 60 * 1000;

  function refresh() {
    // Server actions already revalidate the route; re-fetch this server
    // component in place instead of a full page reload, so the list updates
    // without the whole page flashing/reloading from scratch.
    router.refresh();
  }

  function toggleFeatured(reel: Reel) {
    setBusyId(reel.id);
    startTransition(async () => {
      try {
        await setReelFeatured(reel.id, !reel.featured);
        success(reel.featured ? "Removed from home page." : "Featured on home page.");
        refresh();
      } catch (err) {
        toastError(
          reel.featured
            ? err instanceof Error
              ? err.message
              : "Something went wrong."
            : `Featured, but the video didn't cache: ${err instanceof Error ? err.message : "unknown error"}`
        );
        refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  function uploadVideo(reel: Reel, file: File) {
    setBusyId(reel.id);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        await uploadReelVideo(reel.id, formData);
        success("Video uploaded — it'll show on the home page in place of the placeholder.");
        refresh();
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Upload failed.");
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

      {(lastSyncError || lastTokenRefreshError || tokenWarning) && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            {lastSyncError && <p>Last sync failed: {lastSyncError}</p>}
            {lastTokenRefreshError && (
              <p>Last token refresh failed: {lastTokenRefreshError}</p>
            )}
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
              onUploadVideo={(file) => uploadVideo(reel, file)}
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
  onUploadVideo,
}: {
  reel: Reel;
  busy: boolean;
  onToggle: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onUploadVideo?: (file: File) => void;
}) {
  const thumb = reel.cloudinaryThumbnailUrl ?? reel.igThumbnailUrl;
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn(tableRow, "flex items-center gap-4 p-4")}>
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {thumb && (
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
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
        {/* Instagram's API won't hand over a video for some reels at all (see
            uploadReelVideo's doc comment) — there's nothing left to retry
            automatically, so this is the manual way around it. Only offered
            once a cache attempt has actually failed. */}
        {reel.cacheError && onUploadVideo && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadVideo(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              <Upload className="h-3 w-3" />
              Upload video manually
            </button>
          </>
        )}
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
