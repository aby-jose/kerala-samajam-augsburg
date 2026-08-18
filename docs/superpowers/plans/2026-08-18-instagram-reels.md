# Instagram Reels on the Home Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync Reels from KSA's Instagram account, let an admin curate which ones are featured, and show them in a new horizontal-scroll home page section — with an on-brand animated gradient card standing in for any reel whose video hasn't finished caching yet.

**Architecture:** A `src/lib/instagram.ts` client wraps the Meta Graph API (fetch metadata, cache media to Cloudinary, rotate the long-lived token) behind pure, unit-tested helpers plus thin Prisma-touching orchestrators. `src/lib/instagram-actions.ts` exposes that as server actions for the admin screen and the public home section. A new `HomeSectionId: "reels"` slots into the existing section-registry pattern (schema, metadata, component) exactly like every other home section. A dedicated `?job=` cron route (mirroring, not reusing, the existing email cron route) handles the daily sync and weekly token refresh.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma + MongoDB, Tailwind v4, framer-motion, Zod, Vitest, Cloudinary, native `fetch` (no SDK) for the Meta Graph API.

**Spec:** [docs/superpowers/specs/2026-08-18-instagram-reels-design.md](../specs/2026-08-18-instagram-reels-design.md) — read it alongside this plan; this plan argues from its decisions (D1–D10) and doesn't repeat their rationale.

## Global Constraints

- Credentials live in env vars: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `INSTAGRAM_ACCESS_TOKEN` (seed only — the live, rotating token lives in `InstagramSyncState`, not env).
- No real Meta credentials exist yet (confirmed with the user). Every task must leave the app fully functional with `INSTAGRAM_ACCESS_TOKEN` unset: the sync fails gracefully into `InstagramSyncState.lastSyncError`, and the home section — having zero featured reels — renders nothing.
- Follow existing conventions exactly rather than introducing new ones: singleton content models keyed `"current"` (`HomeContent`/`AboutContent` pattern, not the shared `Config` table), `"use server"` actions guarded by `requirePermission`/`requirePermissionPage` from `src/lib/guards.ts`, button-based reorder (no drag-and-drop library exists in this repo), and only pure functions get unit tests (no Prisma/DB mocking exists anywhere in `tests/`).
- Every new Prisma model follows the existing field style: `id String @id @default(auto()) @map("_id") @db.ObjectId`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt` where mutable.
- Run `npx prisma generate` after any schema change so generated types are current before writing code against them.

---

## Task 1: Prisma models

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `InstagramReel` model (fields: `id, igMediaId, caption, permalink, igThumbnailUrl, igMediaUrl, postedAt, featured, order, cloudinaryVideoUrl, cloudinaryThumbnailUrl, cachedAt, cacheError, syncedAt, createdAt`) and `InstagramSyncState` model (fields: `id, key, accessToken, tokenExpiresAt, lastSyncAt, lastSyncError, lastTokenRefreshAt, lastTokenRefreshError, updatedAt`) — every later task's Prisma calls depend on these exact field names.

- [ ] **Step 1: Add the two models to `prisma/schema.prisma`**

Add after the `GalleryMedia`/`MediaType` block (around line 221), so reel-related models sit near the other media models:

```prisma
model InstagramReel {
  id                     String    @id @default(auto()) @map("_id") @db.ObjectId
  igMediaId              String    @unique
  caption                String?
  permalink              String
  igThumbnailUrl         String?
  igMediaUrl             String?
  postedAt               DateTime
  featured               Boolean   @default(false)
  order                  Int       @default(0)
  cloudinaryVideoUrl     String?
  cloudinaryThumbnailUrl String?
  cachedAt               DateTime?
  cacheError             String?
  syncedAt               DateTime  @updatedAt
  createdAt              DateTime  @default(now())
}

/// Live Instagram sync state — token, expiry, last-run status. One row,
/// keyed "current", same shape as HomeContent/AboutContent. Not folded into
/// Config: Config is in practice single-purpose (always SiteConfig).
model InstagramSyncState {
  id                    String    @id @default(auto()) @map("_id") @db.ObjectId
  key                   String    @unique @default("current")
  accessToken           String?
  tokenExpiresAt        DateTime?
  lastSyncAt            DateTime?
  lastSyncError         String?
  lastTokenRefreshAt    DateTime?
  lastTokenRefreshError String?
  updatedAt             DateTime  @updatedAt
}
```

- [ ] **Step 2: Generate the Prisma client**

Run: `npx prisma generate`
Expected: completes without error; `prisma.instagramReel` and `prisma.instagramSyncState` are now typed in the generated client.

- [ ] **Step 3: Push the schema (if you have a working local `DATABASE_URL`)**

Run: `npx prisma db push`
Expected: `The database is now in sync with your Prisma schema.` MongoDB is schemaless, so this is safe to skip if you don't have DB connectivity right now — the collections are created lazily on first write regardless.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "Add InstagramReel and InstagramSyncState models"
```

---

## Task 2: Instagram data & actions layer

**Files:**
- Create: `src/lib/instagram.ts`
- Create: `src/lib/instagram-actions.ts`
- Create: `src/lib/instagram-reorder.ts`
- Modify: `src/lib/permissions.ts`
- Modify: `.env.example`
- Test: `tests/instagram.test.ts`
- Test: `tests/instagram-reorder.test.ts`

**Interfaces:**
- Consumes: `prisma` from `./prisma`; `uploadToCloudinary(file: string | Buffer, folder?: string): Promise<string>` from `./cloudinary`; `requirePermission(permission: Permission): Promise<StaffContext>` and `requirePermissionPage` from `./guards`.
- Produces (for later tasks): from `instagram.ts` — `parseReelsPage(json: unknown): ParsedReel[]`, `isTokenRefreshDue(expiresAt: Date | null, now?: Date): boolean`, `computeTokenExpiry(expiresInSeconds: number, now?: Date): Date`, `getAccessToken(): Promise<string>`, `fetchReels(): Promise<{created: number; updated: number}>`, `cacheReelMedia(reelId: string): Promise<void>`, `refreshLongLivedToken(): Promise<void>`, `recordSyncError(message: string | null): Promise<void>`. From `instagram-actions.ts` — `getFeaturedReels(maxCount: number): Promise<ReelCardData[]>` (public, no permission check), `setReelFeatured(reelId: string, featured: boolean): Promise<{success: true}>`, `reorderFeaturedReel(reelId: string, direction: "up" | "down"): Promise<{success: true}>`, `syncReelsNow(): Promise<{success: true; created: number; updated: number}>`. From `instagram-reorder.ts` — `reorderFeatured(ids: string[], id: string, direction: "up" | "down"): string[]`. Permission keys: `"reels.view"`, `"reels.manage"`.

- [ ] **Step 1: Write the failing tests for the pure reorder helper**

`tests/instagram-reorder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { reorderFeatured } from "@/lib/instagram-reorder";

describe("reorderFeatured", () => {
  it("swaps an item up with its neighbour", () => {
    expect(reorderFeatured(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
  });

  it("swaps an item down with its neighbour", () => {
    expect(reorderFeatured(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("is a no-op moving the first item up", () => {
    expect(reorderFeatured(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
  });

  it("is a no-op moving the last item down", () => {
    expect(reorderFeatured(["a", "b", "c"], "c", "down")).toEqual(["a", "b", "c"]);
  });

  it("is a no-op for an id that isn't in the list", () => {
    expect(reorderFeatured(["a", "b", "c"], "z", "up")).toEqual(["a", "b", "c"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/instagram-reorder.test.ts`
Expected: FAIL — `Cannot find module '@/lib/instagram-reorder'`.

- [ ] **Step 3: Implement `src/lib/instagram-reorder.ts`**

```ts
/**
 * Swap `id`'s position with its neighbour in `direction`. Pure, so the admin
 * reorder buttons (instagram-actions.ts) can be unit tested without a
 * database — see the frontend/gallery precedent: this repo tests logic, not
 * Prisma calls.
 */
export function reorderFeatured(
  ids: string[],
  id: string,
  direction: "up" | "down"
): string[] {
  const index = ids.indexOf(id);
  if (index === -1) return ids;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return ids;

  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/instagram-reorder.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing tests for the pure Instagram helpers**

`tests/instagram.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeTokenExpiry, isTokenRefreshDue, parseReelsPage } from "@/lib/instagram";

describe("parseReelsPage", () => {
  it("keeps only REELS items, mapped to ParsedReel", () => {
    const parsed = parseReelsPage({
      data: [
        {
          id: "17999",
          caption: "Onam prep",
          media_type: "VIDEO",
          media_product_type: "REELS",
          media_url: "https://ig.example/video.mp4",
          thumbnail_url: "https://ig.example/thumb.jpg",
          permalink: "https://instagram.com/reel/abc",
          timestamp: "2026-08-01T10:00:00+0000",
        },
        {
          id: "18000",
          media_type: "IMAGE",
          media_product_type: "FEED",
          permalink: "https://instagram.com/p/def",
          timestamp: "2026-08-02T10:00:00+0000",
        },
      ],
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      igMediaId: "17999",
      caption: "Onam prep",
      permalink: "https://instagram.com/reel/abc",
      igThumbnailUrl: "https://ig.example/thumb.jpg",
      igMediaUrl: "https://ig.example/video.mp4",
      postedAt: new Date("2026-08-01T10:00:00+0000"),
    });
  });

  it("returns an empty array when there is no data field", () => {
    expect(parseReelsPage({})).toEqual([]);
  });

  it("falls back to the media url for the thumbnail when none is given", () => {
    const parsed = parseReelsPage({
      data: [
        {
          id: "1",
          media_type: "VIDEO",
          media_product_type: "REELS",
          media_url: "https://ig.example/video.mp4",
          permalink: "https://instagram.com/reel/xyz",
          timestamp: "2026-08-01T10:00:00+0000",
        },
      ],
    });
    expect(parsed[0].igThumbnailUrl).toBe("https://ig.example/video.mp4");
  });
});

describe("isTokenRefreshDue", () => {
  const now = new Date("2026-08-18T00:00:00Z");

  it("is due when there is no known expiry", () => {
    expect(isTokenRefreshDue(null, now)).toBe(true);
  });

  it("is not due with more than 14 days remaining", () => {
    expect(isTokenRefreshDue(new Date("2026-09-15T00:00:00Z"), now)).toBe(false);
  });

  it("is due within the 14-day window", () => {
    expect(isTokenRefreshDue(new Date("2026-08-25T00:00:00Z"), now)).toBe(true);
  });

  it("is due once already expired", () => {
    expect(isTokenRefreshDue(new Date("2026-08-01T00:00:00Z"), now)).toBe(true);
  });
});

describe("computeTokenExpiry", () => {
  it("adds the given number of seconds to now", () => {
    const now = new Date("2026-08-18T00:00:00Z");
    expect(computeTokenExpiry(5_184_000, now)).toEqual(new Date("2026-10-17T00:00:00Z"));
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/instagram.test.ts`
Expected: FAIL — `Cannot find module '@/lib/instagram'`.

- [ ] **Step 7: Add the Instagram env vars**

Append to `.env.example`, after the `# --- Media ---` block:

```
# --- Instagram (Meta Graph API) ----------------------------------------------
# Requires a Business/Creator Instagram account linked to a Facebook Page and
# a Meta Developer app — see docs/superpowers/specs/2026-08-18-instagram-reels-design.md
# §11 for the one-time setup. Until these are set, the reels sync fails
# gracefully and the home section stays hidden.
INSTAGRAM_APP_ID=""
INSTAGRAM_APP_SECRET=""
INSTAGRAM_BUSINESS_ACCOUNT_ID=""
# Seed long-lived token. Auto-rotates into InstagramSyncState after the first
# successful refresh — this value is only ever read again if that row is empty.
INSTAGRAM_ACCESS_TOKEN=""
```

- [ ] **Step 8: Implement `src/lib/instagram.ts`**

```ts
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

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${businessAccountId}/media?fields=${MEDIA_FIELDS}&access_token=${token}`;
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

/** Extends the long-lived token via Meta's `fb_exchange_token` grant — the
 *  correct mechanism for a Graph API (not Basic Display API) token, which
 *  has no `ig_refresh_token` endpoint of its own. */
export async function refreshLongLivedToken(): Promise<void> {
  const state = await prisma.instagramSyncState.findUnique({ where: { key: "current" } });
  const currentToken = state?.accessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!currentToken) throw new Error("No Instagram access token to refresh");

  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new Error("INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET are not set");

  const url =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token` +
    `?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${currentToken}`;

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
```

- [ ] **Step 9: Run it to verify the pure-function tests pass**

Run: `npx vitest run tests/instagram.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 10: Add the `reels` permission group**

In `src/lib/permissions.ts`, add after the `// --- Gallery ---` block:

```ts
  // --- Reels ---
  "reels.view": { group: "Reels", label: "View synced Instagram reels", mutates: false },
  "reels.manage": { group: "Reels", label: "Feature, reorder and sync reels", mutates: true },
```

And add `"Reels"` to `PERMISSION_GROUPS`, right after `"Gallery"`:

```ts
export const PERMISSION_GROUPS = [
  "Overview", "Events", "Registrations", "Payments", "Members", "Membership",
  "Gallery", "Reels", "Content", "Inquiries", "Legal", "Email", "System", "Team & Access",
] as const;
```

- [ ] **Step 11: Implement `src/lib/instagram-actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import { cacheReelMedia, fetchReels, recordSyncError } from "./instagram";
import { reorderFeatured } from "./instagram-reorder";

export interface ReelCardData {
  id: string;
  caption: string | null;
  permalink: string;
  cloudinaryVideoUrl: string | null;
  cloudinaryThumbnailUrl: string | null;
}

/**
 * Public — this is what the home page section fetches. Includes featured
 * reels that haven't finished caching yet (cloudinaryVideoUrl null), since
 * those still render as a gradient placeholder card rather than being
 * dropped from the strip.
 */
export async function getFeaturedReels(maxCount: number): Promise<ReelCardData[]> {
  const reels = await prisma.instagramReel.findMany({
    where: { featured: true },
    orderBy: { order: "asc" },
    take: maxCount,
  });

  return reels.map((r) => ({
    id: r.id,
    caption: r.caption,
    permalink: r.permalink,
    cloudinaryVideoUrl: r.cloudinaryVideoUrl,
    cloudinaryThumbnailUrl: r.cloudinaryThumbnailUrl,
  }));
}

export async function setReelFeatured(reelId: string, featured: boolean) {
  await requirePermission("reels.manage");

  if (featured) {
    const count = await prisma.instagramReel.count({ where: { featured: true } });
    await prisma.instagramReel.update({
      where: { id: reelId },
      data: { featured: true, order: count },
    });

    try {
      await cacheReelMedia(reelId);
    } catch (error) {
      // cacheReelMedia already recorded cacheError on the row; the reel stays
      // featured (so it shows the gradient placeholder) but the caller is
      // told the cache attempt failed, for the toast.
      revalidatePath("/admin/reels");
      revalidatePath("/");
      throw new Error(error instanceof Error ? error.message : "Failed to cache reel media");
    }
  } else {
    await prisma.instagramReel.update({
      where: { id: reelId },
      data: { featured: false, order: 0 },
    });
  }

  revalidatePath("/admin/reels");
  revalidatePath("/");
  return { success: true as const };
}

export async function reorderFeaturedReel(reelId: string, direction: "up" | "down") {
  await requirePermission("reels.manage");

  const featured = await prisma.instagramReel.findMany({
    where: { featured: true },
    orderBy: { order: "asc" },
  });

  const reordered = reorderFeatured(featured.map((r) => r.id), reelId, direction);

  await Promise.all(
    reordered.map((id, index) =>
      prisma.instagramReel.update({ where: { id }, data: { order: index } })
    )
  );

  revalidatePath("/admin/reels");
  revalidatePath("/");
  return { success: true as const };
}

export async function syncReelsNow() {
  await requirePermission("reels.manage");

  try {
    const result = await fetchReels();
    revalidatePath("/admin/reels");
    return { success: true as const, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await recordSyncError(message);
    revalidatePath("/admin/reels");
    throw new Error(message);
  }
}
```

- [ ] **Step 12: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors from the new files (unrelated pre-existing errors, if any, are out of scope).

- [ ] **Step 13: Commit**

```bash
git add src/lib/instagram.ts src/lib/instagram-actions.ts src/lib/instagram-reorder.ts \
  src/lib/permissions.ts .env.example tests/instagram.test.ts tests/instagram-reorder.test.ts
git commit -m "Add Instagram Graph API client, curation actions and reels permissions"
```

---

## Task 3: Home page section — schema, registry and component

**Files:**
- Modify: `src/lib/home-schema.ts`
- Modify: `src/lib/home-sections.ts`
- Modify: `src/components/layout/home-sections.tsx`
- Create: `src/components/layout/reels-section.tsx`
- Modify: `tests/home-content.test.ts`

**Interfaces:**
- Consumes: `getFeaturedReels(maxCount: number): Promise<ReelCardData[]>` from `@/lib/instagram-actions` (Task 2); `Eyebrow`, `SectionTitle`, `SectionLead` from `@/components/layout/section-heading`; `Container` from `@/components/layout/container`; `cn` from `@/lib/utils`.
- Produces: `HomeContentT["content"]["reels"]` shape `{heading: string; subheading: string; maxCount: number}`; `ReelsSection` component registered as `HOME_SECTION_COMPONENTS["reels"]`.

- [ ] **Step 1: Add the `reels` section schema and default content**

In `src/lib/home-schema.ts`, add `"reels"` to `HOME_SECTION_IDS`, between `"gallery"` and `"committee"`:

```ts
export const HOME_SECTION_IDS = [
  "hero",
  "about",
  "events",
  "gallery",
  "reels",
  "committee",
  "join",
  "cta",
] as const;
```

Add the schema, after `gallerySectionSchema`:

```ts
export const reelsSectionSchema = z.object({
  heading: z.string().min(1, "Required").max(160),
  subheading: z.string().max(300).optional().or(z.literal("")),
  maxCount: z.number().int().min(1).max(20),
});
```

Add it to `homeContentSchema.content`, after `gallery`:

```ts
  content: z.object({
    hero: heroSectionSchema,
    about: aboutSectionSchema,
    events: eventsSectionSchema,
    gallery: gallerySectionSchema,
    reels: reelsSectionSchema,
    committee: committeeSectionSchema,
    join: joinSectionSchema,
    cta: ctaSectionSchema,
  }),
```

Add the layout entry and default content to `DEFAULT_HOME_CONTENT`, after the `gallery` block:

```ts
  layout: [
    { id: "hero", visible: true },
    { id: "about", visible: true },
    { id: "events", visible: true },
    { id: "gallery", visible: true },
    { id: "reels", visible: true },
    { id: "committee", visible: true },
    { id: "join", visible: true },
    { id: "cta", visible: true },
  ],
  content: {
    // ...unchanged hero/about/events blocks...
    // from components/layout/gallery-strip.tsx
    gallery: { /* unchanged */ },
    // from components/layout/reels-section.tsx — auto-hides until reels are
    // synced and featured, so this is safe to ship visible by default
    reels: {
      heading: "From Instagram",
      subheading: "The latest reels — tap any clip to watch it on Instagram.",
      maxCount: 8,
    },
    // from components/layout/leadership-row.tsx
    committee: { /* unchanged */ },
```

(Leave every other existing block exactly as it is — only the layout array and the insertion of the new `reels` content block change.)

- [ ] **Step 2: Add the `reels` section metadata**

In `src/lib/home-sections.ts`, add to `HOME_SECTION_META`, after `gallery`:

```ts
  reels: {
    label: "Instagram reels",
    description: "Featured reels synced from Instagram. Curated from the Reels admin screen.",
    surfaceMode: "rotate",
    movable: true,
  },
```

- [ ] **Step 3: Update the existing frozen layout tests for the new default order**

In `tests/home-content.test.ts`, the surface sequence changes because `reels` is now a rotating section between `gallery` and `committee`. Replace the `"reproduces today's surfaces at the default order"` test body:

```ts
  it("reproduces today's surfaces at the default order", () => {
    const resolved = resolveSections(DEFAULT_HOME_CONTENT.layout);

    expect(resolved.map((s) => [s.id, s.surface])).toEqual([
      ["hero", "bg-black"],
      ["about", "bg-surface-1"],
      ["events", "bg-surface-2"],
      ["gallery", "bg-surface-1"],
      ["reels", "bg-surface-3"],
      ["committee", "bg-surface-1"],
      ["join", "bg-surface-2"],
      ["cta", "bg-surface-deep"],
    ]);

    expect(resolved.filter((s) => s.bordered).map((s) => s.id)).toEqual([
      "events",
      "reels",
      "join",
    ]);
  });
```

And add `"reels"` to the permutation test's `movable` list:

```ts
    const movable = ["about", "events", "gallery", "reels", "committee", "join", "cta"] as const;
```

- [ ] **Step 4: Add a merge test for the new `reels` content block**

Add to the `describe("mergeHomeContent", ...)` block in `tests/home-content.test.ts`:

```ts
  it("keeps a stored reels heading and fills the rest from defaults", () => {
    const merged = mergeHomeContent({ reels: { heading: "Latest Clips" } });

    expect(merged.reels.heading).toBe("Latest Clips");
    expect(merged.reels.maxCount).toBe(DEFAULT_HOME_CONTENT.content.reels.maxCount);
  });
```

- [ ] **Step 5: Run the updated tests to verify they pass**

Run: `npx vitest run tests/home-content.test.ts`
Expected: PASS, all tests including the two updated and one new.

- [ ] **Step 6: Build the `ReelsSection` component**

`src/components/layout/reels-section.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Instagram } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Eyebrow, SectionLead, SectionTitle } from "@/components/layout/section-heading";
import { DEFAULT_HOME_CONTENT, type HomeContentT } from "@/lib/home-schema";
import { getFeaturedReels, type ReelCardData } from "@/lib/instagram-actions";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export function ReelsSection({
  content = DEFAULT_HOME_CONTENT.content.reels,
  surface = "bg-surface-1",
  bordered = false,
}: {
  content?: HomeContentT["content"]["reels"];
  surface?: string;
  bordered?: boolean;
} = {}) {
  const [reels, setReels] = useState<ReelCardData[]>([]);

  useEffect(() => {
    getFeaturedReels(content.maxCount)
      .then(setReels)
      .catch((error) => console.error("Failed to load featured reels:", error));
    // content.maxCount only changes when an admin edits the section, not per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.maxCount]);

  // Nothing featured yet (or Instagram isn't connected) — no empty band, per
  // spec D9. A featured-but-not-yet-cached reel still counts as present, so
  // this only fires when the featured list itself is empty.
  if (reels.length === 0) return null;

  return (
    <section
      className={cn(
        "relative overflow-hidden py-24 md:py-32",
        surface,
        bordered && "border-y border-border"
      )}
    >
      <Container>
        <motion.div
          className="mb-12 max-w-2xl"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <Eyebrow>Instagram</Eyebrow>
          <SectionTitle className="mt-6">{content.heading}</SectionTitle>
          {content.subheading && (
            <SectionLead className="mt-5 max-w-lg">{content.subheading}</SectionLead>
          )}
        </motion.div>
      </Container>

      <motion.div
        className="flex gap-4 overflow-x-auto px-6 pb-4 snap-x snap-mandatory md:px-[max(1.5rem,calc((100vw-72rem)/2))]"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
      >
        {reels.map((reel) => (
          <motion.div
            key={reel.id}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
            }}
            className="shrink-0 snap-start"
          >
            <ReelCardTile reel={reel} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function ReelCardTile({ reel }: { reel: ReelCardData }) {
  return (
    <a
      href={reel.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block h-[420px] w-[236px] overflow-hidden rounded-[1.75rem] border border-border/10 bg-muted"
    >
      {reel.cloudinaryVideoUrl ? (
        <video
          src={reel.cloudinaryVideoUrl}
          poster={reel.cloudinaryThumbnailUrl ?? undefined}
          muted
          loop
          playsInline
          onMouseEnter={(e) => e.currentTarget.play()}
          onMouseLeave={(e) => e.currentTarget.pause()}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <GradientFallback caption={reel.caption} />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/10 to-transparent p-4">
        {reel.caption && (
          <p className="line-clamp-2 text-xs font-medium text-white/90">{reel.caption}</p>
        )}
      </div>
    </a>
  );
}

/** Shown for a featured reel that hasn't finished caching yet, or whose cache
 *  attempt failed — an animated gradient built from the site's own primary
 *  and surface tokens, not a generic rainbow, so the strip never reads as
 *  broken mid-sync (spec D8). */
function GradientFallback({ caption }: { caption: string | null }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-[length:200%_200%] bg-gradient-to-br from-primary via-surface-3 to-primary"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute inset-0 bg-black/10" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Instagram className="h-8 w-8 text-white/90" strokeWidth={1.5} />
        {caption && <p className="line-clamp-3 text-xs font-medium text-white/90">{caption}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Register it in the home section component registry**

In `src/components/layout/home-sections.tsx`, add the import and the registry entry:

```tsx
import { ReelsSection } from "@/components/layout/reels-section";
```

```tsx
export const HOME_SECTION_COMPONENTS: Record<HomeSectionId, ComponentType<any>> = {
  hero: Hero,
  about: AboutIntro,
  events: EventsBandSection,
  gallery: GalleryStrip,
  reels: ReelsSection,
  committee: LeadershipRow,
  join: JoinSteps,
  cta: JoinCta,
};
```

- [ ] **Step 8: Type-check and run the full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass, including the updated `home-content.test.ts`.

- [ ] **Step 9: Render and visually verify**

Start the dev server (`npm run dev`), open the home page. With no featured reels yet, the section must render nothing — confirm no empty gap or heading appears where `reels` sits in the layout. This is the expected state until Task 4/5 let an admin feature a reel; full visual review of the card/gradient happens once there's a real featured reel in Task 4's manual check.

- [ ] **Step 10: Commit**

```bash
git add src/lib/home-schema.ts src/lib/home-sections.ts \
  src/components/layout/home-sections.tsx src/components/layout/reels-section.tsx \
  tests/home-content.test.ts
git commit -m "Add reels home section: schema, registry and component"
```

---

## Task 4: Admin curation screen

**Files:**
- Modify: `src/app/admin/(dashboard)/layout-client.tsx`
- Create: `src/app/admin/(dashboard)/reels/page.tsx`
- Create: `src/components/admin/reels/reels-manager.tsx`

**Interfaces:**
- Consumes: `requirePermissionPage("reels.view")` from `@/lib/guards`; `prisma` from `@/lib/prisma`; `setReelFeatured`, `reorderFeaturedReel`, `syncReelsNow` from `@/lib/instagram-actions` (Task 2); `useToast()` from `@/components/ui/toast`; `cardSurface`, `panelHeader`, `tableRow` from `@/components/admin/ui/surface`; `Button` from `@/components/ui/button`.

- [ ] **Step 1: Add the "Reels" nav item**

In `src/app/admin/(dashboard)/layout-client.tsx`, add `Film` to the `lucide-react` import list, and add an entry to the `"Media"` group in `NAV_GROUPS`, after `"Gallery"`:

```ts
import {
  BarChart3,
  Calendar,
  Image as ImageIcon,
  Film,
  Settings,
  // ...rest unchanged
} from "lucide-react";
```

```tsx
  {
    label: "Media",
    items: [
      {
        href: "/admin/gallery",
        label: "Gallery",
        icon: ImageIcon,
        permission: "gallery.view",
        isActive: (p) => p.startsWith("/admin/gallery") && !p.includes("/contributions"),
      },
      {
        href: "/admin/reels",
        label: "Reels",
        icon: Film,
        permission: "reels.view",
        isActive: (p) => p.startsWith("/admin/reels"),
      },
      {
        href: "/admin/gallery/contributions",
        label: "Contributions",
        icon: Sparkles,
        permission: "gallery.contributions.view",
        isActive: (p) => p.startsWith("/admin/gallery/contributions"),
      },
    ],
  },
```

- [ ] **Step 2: Build the admin page**

`src/app/admin/(dashboard)/reels/page.tsx`:

```tsx
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
      tokenExpiresAt={syncState?.tokenExpiresAt ?? null}
    />
  );
}
```

- [ ] **Step 3: Build the manager client component**

`src/components/admin/reels/reels-manager.tsx`:

```tsx
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
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors from the new/modified files.

- [ ] **Step 5: Manual verification (render and screenshot)**

Start the dev server, sign in as an admin whose role holds `reels.view`/`reels.manage` (or grant the seeded admin role those permissions), and open `/admin/reels`. With no reels synced yet, both lists should show their empty states and the "Sync now" button should be visible and clickable (it will fail cleanly with "INSTAGRAM_ACCESS_TOKEN is not set" until real credentials exist — confirm the toast shows that message rather than a crash). Screenshot this state for review before moving on, per how visual work gets reviewed here.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(dashboard)/layout-client.tsx" \
  "src/app/admin/(dashboard)/reels/page.tsx" \
  src/components/admin/reels/reels-manager.tsx
git commit -m "Add admin Reels curation screen"
```

---

## Task 5: Cron route

**Files:**
- Create: `src/app/api/cron/instagram/route.ts`

**Interfaces:**
- Consumes: `fetchReels`, `isTokenRefreshDue`, `refreshLongLivedToken`, `recordSyncError` from `@/lib/instagram`; `prisma` from `@/lib/prisma`; `sendMail`, `esc` from `@/lib/email`; `adminEmailOrNull` from `@/lib/admin-contact`.

- [ ] **Step 1: Implement the route**

`src/app/api/cron/instagram/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { fetchReels, isTokenRefreshDue, refreshLongLivedToken, recordSyncError } from "@/lib/instagram";
import { sendMail, esc } from "@/lib/email";
import { adminEmailOrNull } from "@/lib/admin-contact";

/**
 * Instagram sync/token-refresh endpoint.
 *
 * Not folded into the existing `/api/cron` route: that one multiplexes email
 * jobs specifically, and its JobResult shape (sent/skipped/failed email
 * counts) doesn't fit a sync job. Same bearer-secret pattern, separate route.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface JobOutcome {
  job: string;
  ok: boolean;
  message: string;
}

async function runSync(): Promise<JobOutcome> {
  try {
    const result = await fetchReels();
    return { job: "sync", ok: true, message: `created ${result.created}, updated ${result.updated}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordSyncError(message);
    return { job: "sync", ok: false, message };
  }
}

async function runTokenRefresh(): Promise<JobOutcome> {
  const state = await prisma.instagramSyncState.findUnique({ where: { key: "current" } });

  if (!isTokenRefreshDue(state?.tokenExpiresAt ?? null)) {
    return { job: "token-refresh", ok: true, message: "not due yet" };
  }

  try {
    await refreshLongLivedToken();
    return { job: "token-refresh", ok: true, message: "refreshed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    const to = adminEmailOrNull();
    if (to) {
      await sendMail({
        template: "instagram.token-refresh-failed",
        to,
        build: () => ({
          subject: "Instagram token refresh failed",
          previewText: "The Instagram Graph API token could not be refreshed automatically.",
          eyebrow: "SYSTEM ALERT",
          tone: "warning",
          title: "Instagram token refresh failed",
          lead: `The scheduled refresh job failed: ${esc(message)}. The current token has not expired yet, but this needs attention before it does.`,
        }),
      });
    }

    return { job: "token-refresh", ok: false, message };
  }
}

const JOBS: Record<string, () => Promise<JobOutcome>> = {
  sync: runSync,
  "token-refresh": runTokenRefresh,
};

function authorise(request: NextRequest): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return "CRON_SECRET is not set. Set it in the environment before scheduling this endpoint.";
  }

  const header = request.headers.get("authorization");
  const provided =
    header?.replace(/^Bearer\s+/i, "").trim() ||
    request.nextUrl.searchParams.get("secret")?.trim();

  if (provided !== secret) return "Unauthorized";
  return null;
}

async function run(request: NextRequest) {
  const denied = authorise(request);
  if (denied) {
    return NextResponse.json({ error: denied }, { status: denied === "Unauthorized" ? 401 : 500 });
  }

  const requested = request.nextUrl.searchParams.get("job");
  const names = requested ? [requested] : Object.keys(JOBS);

  const unknown = names.filter((n) => !JOBS[n]);
  if (unknown.length) {
    return NextResponse.json(
      { error: `Unknown job: ${unknown.join(", ")}`, available: Object.keys(JOBS) },
      { status: 400 }
    );
  }

  const results = await Promise.all(names.map((name) => JOBS[name]()));

  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

With the dev server running and `CRON_SECRET` set in `.env`, call:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/instagram?job=sync"
```

Expected (no real Instagram credentials yet): `{"ok":false,"results":[{"job":"sync","ok":false,"message":"INSTAGRAM_ACCESS_TOKEN is not set"}]}` — a clean, informative failure, not a 500 or a crash. Confirm `InstagramSyncState.lastSyncError` is now set (visible on `/admin/reels`'s warning banner).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/instagram/route.ts
git commit -m "Add Instagram sync/token-refresh cron route"
```

---

## Final check

- [ ] Run the full suite once more: `npx vitest run && npx tsc --noEmit`
- [ ] Confirm `.env.example` documents all four `INSTAGRAM_*` vars and that the app runs with none of them set (home section hidden, admin screen shows clean failures, no crashes).
- [ ] Re-read spec §11 (manual setup) and hand it to whoever owns the KSA Instagram/Meta account — this plan builds the code, not the Meta app itself.
