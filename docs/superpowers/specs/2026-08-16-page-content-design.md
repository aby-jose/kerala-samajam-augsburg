# Editable Contact, Membership and Listing Pages — Design

**Status:** approved, not yet implemented
**Spec date:** 2026-08-16
**Follows:** [Editable Home Page](2026-08-16-home-page-content-design.md)

## 1. Problem

Three of the four public pages that carry editorial copy still hold it in JSX. An
administrator who wants to change the FAQ answer about parking, or the sentence
explaining what a membership fee pays for, has to open a pull request.

What is already editable:

| Page | State |
|---|---|
| `/about` | `AboutContent` document + admin editor. Done. |
| `/legal/[slug]` | `LegalDocument` + versioned editor. Done. |
| `/` | Content model and rendering done on `feature/home-page-content`; **the admin editor was never built**. |
| `/contact` | Hardcoded. ~700 lines. |
| `/membership` | Plans come from the database; all surrounding copy hardcoded. |
| `/events`, `/gallery` | Listings come from the database; the headings and empty states are hardcoded. |

The home page is the awkward case. Tasks 1–13 of
[its plan](../plans/2026-08-16-home-page-content.md) are committed on
`feature/home-page-content`; Tasks 14–17 — the permission, the nav entry, the
editor shell and every section form — are not. The branch therefore ships a
`saveHomeContent` action with nothing able to call it, and revalidates
`/admin/home`, a route that does not exist.

That branch is also 23 commits behind `main` and no longer compiles against it:
`saveHomeContent` calls `requireAdmin()`, which the RBAC work replaced with
`requirePermission()`.

## 2. Goals

- Every heading, body paragraph, eyebrow, empty state and image on `/contact`,
  `/membership`, `/events` and `/gallery` editable from the admin portal.
- The home page editor finished, so `/` is genuinely editable rather than
  merely content-driven.
- One storage mechanism for page documents, not one per page.
- Nothing changes visually until an administrator saves. Every default is
  today's copy, transcribed exactly.

## 3. Non-goals

- **Section reordering or show/hide on the new pages.** The home page has it
  because its plan built `repairLayout`/`resolveSections` for alternating
  surfaces. Contact, membership and the listings get copy and images only.
- **A block builder.** Administrators edit fields on a fixed page structure.
- **Navbar and footer chrome.** Explicitly out of scope; they stay in code.
- **Migrating `AboutContent` or `HomeContent` onto the new model.** Both work
  and are tested. Churning them buys nothing.
- **Form behaviour.** The contact form's fields, validation and captcha remain
  code. Only the prose around them becomes editable.
- **Translation.** Single-language, as today.

## 4. Decisions

| Decision | Choice | Why |
|---|---|---|
| In-flight branch | Rebase and finish it | 15 commits of tested work; discarding it to rebuild the same design is waste |
| Storage | One `PageContent` model keyed by slug | The cache/merge/upsert/revalidate block is identical per page; the fourth copy earns an abstraction |
| Editors | Hand-written per page | A field-descriptor DSL needs an escape hatch at the first array (contact's FAQ, membership's benefits); bespoke forms stay readable at ~200 lines |
| Permission | One `content.pages.edit` | The roles matrix already carries 20+ rows; these pages are edited by one person in practice |
| Editing depth | Copy and images only | Matches what the About editor does and what the pages need |

`content.home.edit` stays separate — the home page has its own screen, its own
layout controls, and Task 14 of the existing plan already specifies it.

## 5. Data model

```prisma
model PageContent {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  slug      String   @unique   // contact | membership | listings
  value     Json
  updatedAt DateTime @updatedAt
}
```

One row per page document. `slug` rather than `AboutContent`'s `key: "current"`
because this table holds several documents; the singleton models each hold one.

### 5.1 Registry

`src/lib/page-content/registry.ts` is the single place that knows what a slug
means:

```ts
export const PAGE_CONTENT = {
  contact:    { schema: contactContentSchema,    defaults: DEFAULT_CONTACT,    revalidate: ["/contact"] },
  membership: { schema: membershipContentSchema, defaults: DEFAULT_MEMBERSHIP, revalidate: ["/membership"] },
  listings:   { schema: listingsContentSchema,   defaults: DEFAULT_LISTINGS,   revalidate: ["/events", "/gallery"] },
} as const;

export type PageSlug = keyof typeof PAGE_CONTENT;
```

An unknown slug throws rather than creating a document — a typo in a route
parameter must not silently produce an unreachable row.

### 5.2 Actions

`src/lib/page-content/actions.ts`:

```ts
export const getPageContent = cache(async <S extends PageSlug>(slug: S) => …);
export async function savePageContent<S extends PageSlug>(slug: S, data: …) { … }
```

`getPageContent` mirrors `getAboutContent` exactly: `cache()`d per request,
merged over defaults so a document saved before a field existed keeps
rendering, and fail-soft — a database error logs and returns the defaults
rather than blanking the page. `savePageContent` calls
`requirePermission("content.pages.edit")` first, parses through the registry's
schema, upserts, then revalidates every path the registry lists.

### 5.3 Shared section shape

All four pages repeat one structure — `Eyebrow`, `SectionTitle`, an `Accent`
word inside the title, and `SectionLead`:

```ts
export const sectionHeadingFields = {
  eyebrow:    z.string().min(1).max(60),
  title:      z.string().min(1).max(160),
  accentWord: z.string().max(60).optional().or(z.literal("")),
  lead:       z.string().min(1).max(500),
};
```

Spread into each section schema, exactly as `home-schema.ts` spreads its local
`headingFields`. Rendering goes through `withAccent` / `splitOnAccent`, which
land with Phase 1 and are already shared by the About page.

**No `.default()` anywhere in these schemas.** It makes a schema's input and
output types diverge, which react-hook-form's `zodResolver` rejects. Defaults
are merged in by `getPageContent`. This rule is already documented in
[about-schema.ts](../../../src/lib/about-schema.ts).

### 5.4 Documents

**`contact`** — hero, form section heading, FAQ section heading plus an
`items` array of `{ question, answer }`, and the closing "come say hello"
band. The three contact channels above the form are *not* included: they
already read `contactEmail`, `contactPhone` and `address` from `SiteConfig`
and stay there.

The FAQ answers are the one place plain strings are not enough — they carry
inline JSX links today (`<FaqLink href="/events">event page</FaqLink>`).
Answers are stored with a three-line markdown subset, `[label](/href)`, and
rendered through a pure `parseInlineLinks` helper. Nothing else in the prose
is markup: no bold, no lists, nothing that lets an administrator break the
page's typography.

**`membership`** — hero, plans section heading, benefits section heading plus a
`benefits` array. The plans themselves stay `MembershipPlan` rows.

**`listings`** — one document, two sections: `events` and `gallery`, each with a
heading block, the secondary "also on the calendar" / "browse the archive"
heading, and empty-state copy. One document because neither page has enough
copy to justify its own model and admin screen.

## 6. Rendering

All four target pages are `"use client"` today. The established pattern —
`/membership` already works this way, and Task 6 of the home plan did the same
for `/` — is a server route component that awaits the document and hands it to
a client renderer as a prop.

`/membership` needs no restructuring: its `page.tsx` is already a server
component wrapping `MembershipClient`. `/contact` and `/events` do: their route
files carry `"use client"`, so the markup moves into `contact-client.tsx` and
`events-client.tsx` and the route file becomes a thin server component. Pure
refactors — the rendered output must be identical before content is threaded
through.

Every section component keeps working with no props, defaulting to the built-in
defaults, so a component rendered from somewhere else does not break.

## 7. Admin surface

One dynamic route, `src/app/admin/(dashboard)/pages/[slug]/page.tsx`:

```tsx
export default async function PageContentPage({ params }) {
  await requirePermissionPage("content.pages.edit");
  const { slug } = await params;
  if (!isPageSlug(slug)) notFound();
  return <PageContentEditor slug={slug} initialData={await getPageContent(slug)} />;
}
```

`PageContentEditor` dispatches to one of three hand-written forms —
`contact-content-editor.tsx`, `membership-content-editor.tsx`,
`listings-content-editor.tsx` — each modelled on `about-content-editor.tsx`
(~220 lines: `useForm` + `zodResolver`, `useFieldArray` for the arrays, a
toast on save).

All three reuse `Field` from `src/components/admin/ui/field.tsx`, which Task 14
of the home plan lifts out of the About editor. Phase 2 depends on Phase 1 for
that file.

Navigation adds a "Pages" group with one entry per slug. Admin nav is already
permission-filtered, so the group appears only for roles holding
`content.pages.edit`.

## 8. Permissions

Two additions to `src/lib/permissions.ts`, both in the existing `Content` group:

```ts
"content.home.edit":  { group: "Content", label: "Edit the Home page",  mutates: true },
"content.pages.edit": { group: "Content", label: "Edit site pages",     mutates: true },
```

`tests/permissions.test.ts` asserts a total count — `ALL_PERMISSIONS` is 53 on
`main` today, so both additions together take it to 55. Read the current value
rather than trusting this number: Phase 1 adds `content.home.edit` before
Phase 2 adds `content.pages.edit`, so each phase bumps it by one.

Neither permission is granted to any existing role automatically. Whoever runs
the deploy grants them from the roles screen; the plan carries an explicit step
saying so, because a silently missing permission looks exactly like a broken
page.

## 9. Phases

**Phase 1 — Land the home page.** Rebase `feature/home-page-content` onto
`main`, then execute Tasks 14–17 of its existing plan. Reconciliation work the
rebase forces:

- `saveHomeContent`: `requireAdmin()` → `requirePermission("content.home.edit")`.
- `(public)/page.tsx`: the branch rewrites this file; `main` now wraps
  `GalleryStrip`, `JoinSteps` and the CTA band in `features.enableGallery` /
  `features.enableMembership` checks. The page is a server component on the
  branch, so the flags come from `getConfig()` server-side and filter the
  resolved section list rather than wrapping JSX. A hidden module and a hidden
  section must compose: either one hides the section.
- The branch's ISR revalidation against the `dynamic = "force-dynamic"` now on
  `(public)/layout.tsx`. The layout setting wins; confirm the branch's
  `revalidate` export is not fighting it, and that `/` still renders per request.

**Phase 2 — Storage layer.** `PageContent` model, `page-content/actions.ts`,
`registry.ts`, `sectionHeadingFields`, `content.pages.edit`, tests. No page
consumes it yet.

**Phase 3 — Contact.** Schema and defaults, extract `contact-client.tsx`,
thread content, editor, tests.

**Phase 4 — Membership.** Schema and defaults, thread content through the
existing server wrapper, editor, tests.

**Phase 5 — Listings.** Schema and defaults, extract `events-client.tsx`,
thread both pages, editor with two tabs, tests.

Phases 3–5 are independent of each other and share only Phase 2.

## 10. Testing

Vitest runs in a `node` environment and collects only `tests/**/*.test.ts`. No
JSX, and no module that transitively imports a React component or
`@/lib/prisma` may be imported by a test — so testable logic lives in pure
`src/lib` modules.

Per phase:

- **Storage** — merge-over-defaults keeps stored fields and fills the rest;
  empty arrays fall back to defaults; unknown slug throws; unknown keys are
  dropped; the merged result still satisfies the schema.
- **Per page** — the schema accepts its own defaults; required fields reject
  empty strings; the accent word renders plain when absent from the title.
- **Permissions** — `tests/permissions.test.ts` count, and
  `tests/action-coverage.test.ts`, which asserts every server action is
  permission-checked. New actions must be registered there.

Each phase ends with `npm test`, `npm run lint` and `npm run build` green, plus
a manual diff of the rendered page against `main` to confirm nothing moved.

## 11. Risks

**The rebase is the sharp edge.** 23 commits of divergence, a guards API that
changed underneath the branch, and four files that both sides edited. If it
turns ugly, the fallback is to cherry-pick the 15 commits onto a fresh branch
off `main` in dependency order — they are small and well separated.

**Copy transcription.** Defaults must match today's strings character for
character, em dashes and curly apostrophes included. No test catches this; each
conversion task needs an explicit diff step, as the home plan does.

**Large client components.** `/contact` is ~700 lines and `/events` ~196.
Extracting a client half is mechanical but touches a lot of markup; the
rendered output must be verified unchanged before any content is threaded in.

**Permission not granted.** A role without `content.pages.edit` sees no nav
entry and a redirect on the direct URL — indistinguishable from a bug. The
deploy step must grant it.

## 12. File inventory

**Phase 1** — per Tasks 14–17 of the home plan: `src/lib/permissions.ts`,
`src/app/admin/(dashboard)/layout.tsx`, `src/components/admin/ui/field.tsx`,
`src/components/admin/home/*`, `src/app/admin/(dashboard)/home/page.tsx`, plus
the rebase reconciliations above.

**Phase 2** — `prisma/schema.prisma`, `src/lib/page-content/{actions,registry,section}.ts`,
`src/lib/permissions.ts`, `tests/page-content.test.ts`.

**Phase 3** — `src/lib/page-content/contact.ts`,
`src/app/(public)/contact/{page,contact-client}.tsx`,
`src/components/admin/pages/contact-content-editor.tsx`.

**Phase 4** — `src/lib/page-content/membership.ts`,
`src/app/(public)/membership/page.tsx`,
`src/components/public/membership-client.tsx`,
`src/components/admin/pages/membership-content-editor.tsx`.

**Phase 5** — `src/lib/page-content/listings.ts`,
`src/app/(public)/events/{page,events-client}.tsx`,
`src/app/(public)/gallery/{page,gallery-landing-client}.tsx`,
`src/components/admin/pages/listings-content-editor.tsx`.

**Shared admin route** — `src/app/admin/(dashboard)/pages/[slug]/page.tsx`,
`src/components/admin/pages/page-content-editor.tsx`.
