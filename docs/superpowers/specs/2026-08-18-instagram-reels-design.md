# Instagram Reels on the Home Page — Design

Date: 2026-08-18
Status: Approved for planning

## 1. Problem

KSA posts Reels to Instagram but nothing on the site surfaces them. Visitors
who don't already follow the account never see that content, and there's no
way to feature the best clips on the page most people land on first.

## 2. Goals

- Pull Reels from KSA's Instagram account automatically, on a schedule, with
  no manual copy/paste.
- Let an admin choose which synced Reels actually appear on the home page,
  and control their order — same curation model as Gallery.
- A new, reorderable/hideable home section, consistent with how every other
  home section already works.
- Playback that doesn't silently break when Instagram's own CDN links expire
  or rotate.
- A video card that never looks broken: while a clip is loading, mid-cache,
  or unavailable, it shows an on-brand animated gradient placeholder instead
  of an error state or empty box.
- Credentials configured through env vars, per requirement.

## 3. Non-goals

- Publishing/uploading to Instagram from the site — read-only sync.
- A full in-site video player/lightbox for reels — a card click opens the
  real Instagram permalink in a new tab.
- Any UI for creating the Meta Developer app, Business/Creator Instagram
  account, or generating the first long-lived token — that's a one-time
  manual setup outside the codebase. Documented in §11, not built.
- Live end-to-end verification against real Instagram data. Meta credentials
  don't exist yet (confirmed with the user); the integration is built and
  unit-tested against the documented Graph API response shape, and needs a
  real credential pass once the account/app exist.
- Translations, analytics on reel engagement, comment/like counts.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | New `InstagramReel` Prisma model, one row per synced reel | Mirrors `GalleryMedia`'s shape; reels are their own content type (sourced from Instagram, not uploaded), so they don't belong inside `GalleryMedia`. |
| D2 | Metadata (all recent reels) syncs daily via cron; media (video+thumbnail) is cached to Cloudinary only when an admin marks a reel "featured" | Keeps Cloudinary storage/bandwidth cost proportional to what's actually shown, not to everything ever posted. |
| D3 | The live access token lives in the `Config` table (existing `{key, value: Json}` pattern), seeded from `INSTAGRAM_ACCESS_TOKEN` env on first run | Env vars are static per deploy; a token that auto-rotates every ~60 days needs a writable store. Env stays the source of truth for initial setup. |
| D4 | Token refresh is a separate weekly cron from the daily metadata sync, and emails `ADMIN_EMAIL` (existing Resend setup) on failure | A dead token should surface as an alert well before the ~60-day hard expiry, not as a silently stale home section. |
| D5 | New `HomeSectionId: "reels"`, slotted after `gallery` in `HOME_SECTION_IDS`, hideable and movable like the other non-hero sections | Same registry-driven pattern as every existing section (`src/lib/home-schema.ts`, `src/lib/page-layout.ts`) — no new mechanism. |
| D6 | The `reels` home content block stores only copy (`heading`, `subheading`, `maxCount`) — which reels show comes from `InstagramReel.featured`/`order`, not from home content | Same relationship gallery-strip already has to the Gallery module: the home section is a *view* onto curated content, not its own copy of it. |
| D7 | Layout is a horizontal snap-scroll strip of vertical 9:16 cards | Matches the real aspect ratio of Reels; per user's preference over a static grid. |
| D8 | A card without a cached Cloudinary video (not yet cached, still syncing, or cache failed) renders an animated gradient placeholder using the site's actual primary/accent tokens, with the caption overlaid | The section must never look broken mid-sync or mid-failure; a generic rainbow gradient would clash with the site's editorial look, so it draws from the real palette. |
| D9 | Zero featured reels → the whole section auto-hides | Consistent with how other optional/empty sections already behave; no empty-state placeholder band. |
| D10 | Admin screen at `/admin/reels`, under the existing "Media" nav group, permission-gated the same way Gallery is | One more entry in an existing pattern rather than a new area of the admin. |

## 5. Data model

MongoDB via Prisma — `prisma db push`, no migration file.

```prisma
model InstagramReel {
  id                    String    @id @default(auto()) @map("_id") @db.ObjectId
  igMediaId             String    @unique
  caption               String?
  permalink             String
  igThumbnailUrl        String?   // raw IG CDN link — browsing/admin preview only, may expire
  igMediaUrl            String?   // raw IG CDN link — browsing/admin preview only, may expire
  postedAt              DateTime  // when it was posted on Instagram
  featured              Boolean   @default(false)
  order                 Int       @default(0)      // among featured reels only
  cloudinaryVideoUrl    String?                     // set once cached
  cloudinaryThumbnailUrl String?                    // set once cached
  cachedAt              DateTime?
  cacheError            String?                     // last cache failure, if any
  syncedAt              DateTime  @updatedAt         // last metadata refresh
  createdAt             DateTime  @default(now())
}
```

The live token/expiry/sync-status reuse the existing `Config` model, one row
each, e.g. keys `instagram.accessToken`, `instagram.tokenExpiresAt`,
`instagram.lastSyncAt`, `instagram.lastSyncError`.

### 5.1 Home content schema addition

`src/lib/home-schema.ts` gains a `reels` content block:

```ts
reels: {
  heading: string,      // default: "From Instagram"
  subheading: string,   // default: "" (optional)
  maxCount: number,     // default: 8 — caps how many featured reels render, oldest-order truncated
}
```

`HOME_SECTION_IDS` gains `"reels"` inserted after `"gallery"`. Default
`SectionMeta` for `reels`: `hideable: true`, `movable: true`, `surfaceMode`
matching neighboring sections (rotate).

## 6. Instagram integration (`src/lib/instagram.ts`)

- `getAccessToken()` — reads `Config["instagram.accessToken"]`, falling back
  to and seeding from `process.env.INSTAGRAM_ACCESS_TOKEN` if the `Config`
  row doesn't exist yet.
- `fetchReels()` — calls the Graph API
  `GET /{INSTAGRAM_BUSINESS_ACCOUNT_ID}/media` filtered to
  `media_product_type=REELS`, paginated, mapped to `{igMediaId, caption,
  permalink, igThumbnailUrl, igMediaUrl, postedAt}`. Upserts into
  `InstagramReel` by `igMediaId` (insert new, refresh raw IG URLs +
  `syncedAt` on existing, never touch `featured`/`order`/`cloudinary*`
  fields for existing rows).
- `cacheReelMedia(reel)` — downloads `igMediaUrl`/`igThumbnailUrl` and
  re-uploads through the existing `src/lib/cloudinary.ts` upload function
  (`resource_type: "auto"`, same path video already takes in Gallery),
  writes `cloudinaryVideoUrl`/`cloudinaryThumbnailUrl`/`cachedAt`, clears
  `cacheError` on success or sets it on failure.
- `isTokenRefreshDue(expiresAt)` — pure function, true when within 14 days of
  expiry; unit-testable without hitting the network.
- `refreshLongLivedToken()` — calls the Graph API's long-lived token refresh
  endpoint, writes the new token + computed expiry into `Config`.

## 7. Cron jobs

Both protected by the existing `CRON_SECRET` bearer-token pattern used by
current cron routes.

- `src/app/api/cron/instagram-sync/route.ts` (daily) — calls `fetchReels()`.
  Failure is caught, written to `Config["instagram.lastSyncError"]`, and does
  *not* throw past the route (the home page must keep showing the
  last-known-good featured reels regardless of sync health).
- `src/app/api/cron/instagram-token-refresh/route.ts` (weekly) — calls
  `isTokenRefreshDue()` then `refreshLongLivedToken()` if due. On failure,
  emails `ADMIN_EMAIL` via the existing Resend setup so a human can
  intervene inside the ~60-day window.

Marking a reel "featured" in the admin screen triggers `cacheReelMedia()`
directly from that server action — not from either cron — so caching happens
exactly when it's needed and the admin gets immediate success/failure
feedback.

## 8. Admin screen

- Nav: new "Reels" item in the existing "Media" group
  (`src/app/admin/(dashboard)/layout-client.tsx`), permission-gated the same
  way as Gallery's entry.
- Route: `src/app/admin/(dashboard)/reels/page.tsx` +
  `src/components/admin/reels/reels-manager.tsx`.
- Shows every synced `InstagramReel` (thumbnail — Cloudinary if cached, else
  raw IG CDN — caption excerpt, posted date), each row with:
  - A "Featured" toggle (triggers `cacheReelMedia()` on turning on).
  - Drag-reorder among featured rows only (same reorder control pattern as
    home section ordering).
  - A manual "Sync now" button calling the same `fetchReels()` path as the
    daily cron, for immediate testing without waiting for the schedule.
- A status banner surfaces `Config["instagram.lastSyncError"]` and warns when
  the token is within its 14-day refresh window but hasn't refreshed yet.

## 9. Home page component

- `src/components/layout/reels-section.tsx`, registered in
  `HOME_SECTION_COMPONENTS["reels"]`.
- Server-fetches `InstagramReel` where `featured: true`, ordered by `order`,
  capped at the content block's `maxCount`. Returns `null` (section renders
  nothing) when the list is empty.
- Heading via the existing `Eyebrow`/`SectionTitle`/`SectionLead` primitives
  for visual parity with every other section.
- Horizontal `overflow-x-auto` + `snap-x` strip of vertical 9:16 cards,
  framer-motion staggered entrance on scroll into view (matching
  `gallery-strip.tsx`'s pattern).
- Each card:
  - **Has a cached video** → `<video muted loop playsInline>` with
    `cloudinaryThumbnailUrl` as `poster`; autoplay on hover/in-view, paused
    otherwise (same interaction as the gallery album hover-preview). Clicking
    the card opens `permalink` in a new tab.
  - **No cached video yet** (not featured long enough to have finished
    caching, or `cacheError` set) → animated gradient placeholder card:
    CSS/framer-motion gradient built from the site's `--primary`/accent
    tokens (not an arbitrary rainbow), a small Instagram glyph, and the
    caption text overlaid — visually a finished card, not a loading spinner
    or broken-image icon.

## 10. Env vars

Added to `.env.example`, alongside the existing Media section:

```
# Instagram (Meta Graph API)
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
INSTAGRAM_ACCESS_TOKEN=        # seed long-lived token; auto-rotates into Config after first refresh
```

`CRON_SECRET` already exists and is reused as-is to protect the two new
routes.

## 11. Manual setup required (outside this codebase)

Not built by this feature — needed once, by whoever owns the KSA Instagram
account, before any of this can sync real data:

1. Convert the KSA Instagram account to a Business or Creator account, if
   it isn't already, and link it to a Facebook Page.
2. Create a Meta Developer app at developers.facebook.com, add the
   Instagram Graph API product.
3. Generate a long-lived access token for that app/account (via Meta's
   Graph API Explorer or an OAuth flow) with the `instagram_basic` /
   `pages_show_list` permissions.
4. Note the Instagram Business Account ID (available via
   `GET /me/accounts` → the linked Page → its `instagram_business_account`
   field).
5. Put the App ID, App Secret, Business Account ID, and the initial token
   into the site's env vars (§10).

Until this is done, the sync cron will fail gracefully (logged to
`Config["instagram.lastSyncError"]`, no crash) and the home section stays
hidden (zero featured reels).

## 12. Error handling

- Sync failure: caught in the cron route, recorded, home page unaffected —
  it always renders the last successfully cached featured reels.
- Token refresh failure: email alert to `ADMIN_EMAIL`; sync continues
  working on the old token until it actually expires.
- Per-reel cache failure: `cacheError` recorded on that row, reel excluded
  from home display (falls back to the gradient placeholder in the admin
  preview list too) until an admin retries by re-toggling "Featured".

## 13. Testing

Vitest, matching existing `tests/` conventions:

- `isTokenRefreshDue()` — pure date-math function, several boundary cases.
- Featured/order query logic (caps at `maxCount`, respects `order`).
- Home content merge for the new `reels` block (defaults + partial saved
  data), mirroring how `mergeHomeContent` is already tested for other
  sections.
- `fetchReels()`/`cacheReelMedia()` against mocked Graph API and Cloudinary
  responses (no real network/credentials available yet — see §3, §11).

## 14. Open questions

None blocking. The one dependency outside this team's control is the manual
Meta/Instagram account setup in §11, which the code is written to tolerate
being absent (graceful failure, hidden section) until it's done.
