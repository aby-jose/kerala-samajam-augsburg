/**
 * Instagram Graph API client.
 *
 * Pure parsing/date-math helpers are exported separately from the
 * Prisma-touching orchestrators below them, so the former can be unit
 * tested directly — this repo has no Prisma/DB mocking infrastructure, so
 * that split is how every other lib module (home-schema.ts, page-layout.ts)
 * stays testable too.
 *
 * No Instagram SDK exists in package.json; every call is a plain `fetch`
 * against the documented REST endpoints, matching the pattern already used
 * for the Pollinations.ai call in event-actions.ts.
 *
 * Talks to `graph.instagram.com`, not `graph.facebook.com` — this account
 * was set up via Meta's standalone "Instagram API with Instagram Login"
 * (no linked Facebook Page), whose `IGAA…` tokens are only valid on that
 * host. The Facebook-Login variant (Page-linked, `EAA…` tokens, §11 of the
 * design doc) uses `graph.facebook.com` instead and is NOT what this talks
 * to — don't "fix" the host back without checking which flow the live
 * token actually came from.
 */

import { prisma } from "./prisma";
import { uploadToCloudinary } from "./cloudinary";

const GRAPH_API_VERSION = "v21.0";
const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp";
/** Refresh once expiry is within this many days — see spec D4. */
const REFRESH_WINDOW_DAYS = 14;

export interface ParsedReel {
  igMediaId: string;
  caption: string | null;
  permalink: string;
  igThumbnailUrl: string | null;
  igMediaUrl: string | null;
  postedAt: Date;
}

interface GraphMediaItem {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

// --- Pure helpers ------------------------------------------------------------

/** Keeps only actual Reels — the Graph API returns every media type mixed
 *  together, filtered client-side since there is no server-side filter for it. */
export function parseReelsPage(json: unknown): ParsedReel[] {
  const items = (json as { data?: GraphMediaItem[] })?.data ?? [];

  return items
    .filter((item) => item.media_product_type === "REELS")
    .map((item) => ({
      igMediaId: item.id,
      caption: item.caption ?? null,
      permalink: item.permalink,
      igThumbnailUrl: item.thumbnail_url ?? item.media_url ?? null,
      igMediaUrl: item.media_url ?? null,
      postedAt: new Date(item.timestamp),
    }));
}

export function isTokenRefreshDue(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  const msRemaining = expiresAt.getTime() - now.getTime();
  return msRemaining <= REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function computeTokenExpiry(expiresInSeconds: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + expiresInSeconds * 1000);
}

// --- Orchestrators (Prisma + network; not unit tested, per repo convention) --

/** The live token, seeded from env into InstagramSyncState the first time
 *  there isn't one stored yet. See spec D3 for why it isn't kept in env alone. */
export async function getAccessToken(): Promise<string> {
  const state = await prisma.instagramSyncState.findUnique({ where: { key: "current" } });
  if (state?.accessToken) return state.accessToken;

  const seed = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!seed) throw new Error("INSTAGRAM_ACCESS_TOKEN is not set");

  await prisma.instagramSyncState.upsert({
    where: { key: "current" },
    update: { accessToken: seed },
    create: { key: "current", accessToken: seed },
  });

  return seed;
}

/** Records (or clears) the last sync failure — called by both the manual
 *  "Sync now" action and the daily cron so the admin banner and any future
 *  caller agree on one place this is written. */
export async function recordSyncError(message: string | null): Promise<void> {
  await prisma.instagramSyncState.upsert({
    where: { key: "current" },
    update: { lastSyncError: message },
    create: { key: "current", lastSyncError: message },
  });
}

/** Pulls current Reels metadata and upserts by igMediaId. Never touches
 *  featured/order/cloudinary* on an existing row — those are admin-owned. */
export async function fetchReels(): Promise<{ created: number; updated: number }> {
  const token = await getAccessToken();
  const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();
  if (!businessAccountId) throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID is not set");

  // One page only: the most recent 50 media items of ALL types (reels are
  // filtered out of that set by parseReelsPage). Enough to surface recent
  // reels every sync, but it will not backfill an entire historical archive.
  const url = `https://graph.instagram.com/${GRAPH_API_VERSION}/${businessAccountId}/media?fields=${MEDIA_FIELDS}&limit=50&access_token=${token}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Instagram media fetch failed: ${response.status}`);
  }

  const reels = parseReelsPage(await response.json());
  let created = 0;
  let updated = 0;

  for (const reel of reels) {
    const existing = await prisma.instagramReel.findUnique({
      where: { igMediaId: reel.igMediaId },
    });

    if (existing) {
      await prisma.instagramReel.update({
        where: { igMediaId: reel.igMediaId },
        data: {
          caption: reel.caption,
          permalink: reel.permalink,
          igThumbnailUrl: reel.igThumbnailUrl,
          igMediaUrl: reel.igMediaUrl,
          postedAt: reel.postedAt,
        },
      });
      updated++;
    } else {
      await prisma.instagramReel.create({ data: reel });
      created++;
    }
  }

  await prisma.instagramSyncState.upsert({
    where: { key: "current" },
    update: { lastSyncAt: new Date(), lastSyncError: null },
    create: { key: "current", lastSyncAt: new Date() },
  });

  return { created, updated };
}

/** Downloads a featured reel's video + thumbnail and re-hosts them on
 *  Cloudinary, so playback survives Instagram's own URLs expiring. Records
 *  the failure on the row itself rather than throwing silently — the caller
 *  still sees the error via the rejected promise. */
export async function cacheReelMedia(reelId: string): Promise<void> {
  const reel = await prisma.instagramReel.findUnique({ where: { id: reelId } });
  if (!reel) throw new Error("Reel not found");
  if (!reel.igMediaUrl) throw new Error("Reel has no media URL to cache");

  try {
    const videoUrl = await uploadToCloudinary(reel.igMediaUrl, "reels");
    const thumbnailUrl = reel.igThumbnailUrl
      ? await uploadToCloudinary(reel.igThumbnailUrl, "reels")
      : videoUrl;

    await prisma.instagramReel.update({
      where: { id: reelId },
      data: {
        cloudinaryVideoUrl: videoUrl,
        cloudinaryThumbnailUrl: thumbnailUrl,
        cachedAt: new Date(),
        cacheError: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.instagramReel.update({ where: { id: reelId }, data: { cacheError: message } });
    throw error;
  }
}

/** Extends the long-lived token via the `ig_refresh_token` grant — the
 *  correct mechanism for an Instagram-Login token (`IGAA…`), unlike a
 *  Facebook-Login Page token which would instead use the `fb_exchange_token`
 *  grant against `graph.facebook.com`. No app id/secret involved: the grant
 *  authenticates with the token being refreshed alone. */
export async function refreshLongLivedToken(): Promise<void> {
  const state = await prisma.instagramSyncState.findUnique({ where: { key: "current" } });
  const currentToken = state?.accessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!currentToken) throw new Error("No Instagram access token to refresh");

  const url =
    `https://graph.instagram.com/refresh_access_token` +
    `?grant_type=ig_refresh_token&access_token=${currentToken}`;

  const response = await fetch(url);
  if (!response.ok) {
    const message = `Instagram token refresh failed: ${response.status}`;
    await prisma.instagramSyncState.upsert({
      where: { key: "current" },
      update: { lastTokenRefreshAt: new Date(), lastTokenRefreshError: message },
      create: { key: "current", lastTokenRefreshAt: new Date(), lastTokenRefreshError: message },
    });
    throw new Error(message);
  }

  const json = (await response.json()) as { access_token: string; expires_in: number };
  const tokenExpiresAt = computeTokenExpiry(json.expires_in);

  await prisma.instagramSyncState.upsert({
    where: { key: "current" },
    update: {
      accessToken: json.access_token,
      tokenExpiresAt,
      lastTokenRefreshAt: new Date(),
      lastTokenRefreshError: null,
    },
    create: {
      key: "current",
      accessToken: json.access_token,
      tokenExpiresAt,
      lastTokenRefreshAt: new Date(),
    },
  });
}
