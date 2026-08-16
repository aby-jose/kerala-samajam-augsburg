# Editable Home Page — Design

Date: 2026-08-16
Status: Approved for planning

## 1. Problem

Every word and picture on the home page is hardcoded across six components.
The headline in [hero.tsx](../../../src/components/layout/hero.tsx), the six
pillars and three facts in
[about-intro.tsx](../../../src/components/layout/about-intro.tsx), the three
steps in [join-steps.tsx](../../../src/components/layout/join-steps.tsx), and
the two heading blocks written inline in
[page.tsx](../../../src/app/(public)/page.tsx) all require a code change and a
deploy to correct a typo.

The About page solved this a while ago: `AboutContent` in the database, a zod
schema with built-in defaults, a cached getter, and an admin form. The home
page — the page most visitors see first — has none of it.

## 2. Goals

- Every heading, eyebrow, lead, button label, image, video and list item on the
  home page is editable from the admin portal.
- Sections can be hidden and reordered without a deploy, and the page's
  background rotation stays correct in any order.
- Before anybody saves an edit, the page renders exactly the copy it renders
  today.
- The pattern is recognisably the one the About page already established, so
  the next content-editable page is a third instance rather than a third
  invention.

## 3. Non-goals

Deliberately excluded; each can be added later without rework.

- A live preview of the home page inside the editor.
- Adding, duplicating or removing section *types* — the seven sections are
  bespoke and fixed. Only their order, visibility and contents are editable.
- Translations. The site is English-only outside the legal documents.
- Editing the data the sections pull in: events, gallery photos and committee
  members keep their own admin areas.
- Converting [gallery-strip.tsx](../../../src/components/layout/gallery-strip.tsx)
  and [leadership-row.tsx](../../../src/components/layout/leadership-row.tsx)
  from client-side fetching to server fetching.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | A new `HomeContent` model, shaped exactly like `AboutContent` | Same problem, same solution. A single JSON document read once per request and written whole. |
| D2 | `layout` is an ordered array of `{id, visible}`; `content` is an object keyed by section id | Order *is* array order, so a move is a swap. Content keyed by id means field paths never change when a section moves. |
| D3 | Section id → component, defaults and surface mode live in one registry | Adding a section later is one schema entry and one registry entry. Nothing else has to learn about it. |
| D4 | Surfaces are computed from position, not stored | Reordering must not be able to produce two identical adjacent backgrounds, and an admin should not have to reason about colour rotation. |
| D5 | Surface reaches components as props; there is no wrapper element | `LeadershipRow` is shared with the About page and already speaks `seamless`/`tone`. Props keep one code path for both callers and avoid nesting a `<section>` in a `<section>`. |
| D6 | The hero is pinned to first; hideable but not movable | A full-height autoplaying video band mid-page is not a layout the rest of the design supports, and the navbar renders transparent over it. |
| D7 | The CTA band keeps `surface-deep` and `tone="dark"` wherever it lands | Its type is white. Rotating it onto a light surface would make it unreadable. |
| D8 | `getHomeContent()` repairs the layout as well as merging defaults | Otherwise a section added in a later release is invisible on any site that has already saved once. |
| D9 | Upload reuses `ImageUpload` with a video preview branch, not a new component | The server side already accepts mp4/mov/webm up to 100 MB through the same Cloudinary action on `resource_type: "auto"`. |
| D10 | Guarded with `requireAdminPage`/`requireAdmin`, as the About page is today | The in-flight RBAC work migrates both pages in one move rather than leaving this one on a different mechanism. |

## 5. Data model

A new Prisma model, mirroring `AboutContent`. MongoDB, so this is a
`prisma db push` with no migration file.

```prisma
model HomeContent {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  key       String   @unique @default("current")
  value     Json     // Stores HomeContentT — see lib/home-schema.ts
  updatedAt DateTime @updatedAt
}
```

### 5.1 Schema

`src/lib/home-schema.ts`:

```ts
export const HOME_SECTION_IDS = [
  "hero", "about", "events", "gallery", "committee", "join", "cta",
] as const;

export const homeContentSchema = z.object({
  layout: z.array(z.object({
    id: z.enum(HOME_SECTION_IDS),
    visible: z.boolean(),
  })),
  content: z.object({
    hero: heroSectionSchema,
    about: aboutSectionSchema,
    events: eventsSectionSchema,
    gallery: gallerySectionSchema,
    committee: committeeSectionSchema,
    join: joinSectionSchema,
    cta: ctaSectionSchema,
  }),
});
```

Two conventions carried over from
[about-schema.ts](../../../src/lib/about-schema.ts):

- No `.default()` anywhere. It makes the schema's input and output types
  diverge, which react-hook-form's resolver rejects. `getHomeContent()` merges
  the defaults in instead.
- Icons are a named tuple (`HOME_ICONS`) with a name → component map in
  `src/lib/home-icons.ts` shared by the form and the renderer, so the form can
  offer a dropdown and the renderer never guesses whether a stored string is a
  real icon.

A `linkSchema` (`{ label, href }`) is shared by every button and text link.

### 5.2 Section catalogue

Defaults are the current copy, extracted verbatim from the components.

| Section | Fields |
|---|---|
| `hero` | `badge`, `headline`, `accentWord`, `lead`, `primaryCta`, `secondaryCta`, `videoUrl`, `posterUrl` |
| `about` | `eyebrow`, `title`, `accentWord`, `lead`, `facts[]` (2–4 × `{value, label}`), `storyLink`, `collage.primary` (`{url, alt, caption}`), `collage.secondary` (`{url, alt}`), `quote` (`{text, footnote}`), `pillarsEyebrow`, `pillarsNote`, `pillars[]` (1–8 × `{icon, title, desc}`) |
| `events` | `eyebrow`, `title`, `accentWord`, `lead`, `count` (1–8), `cta`, `empty` (`{title, body}`) |
| `gallery` | `eyebrow`, `title`, `accentWord`, `lead`, `link` |
| `committee` | `eyebrow`, `title`, `accentWord`, `lead`, `limit` (1–24) |
| `join` | `eyebrow`, `title`, `accentWord`, `lead`, `cta`, `steps[]` (1–6 × `{title, desc}`) |
| `cta` | `eyebrow`, `title`, `accentWord`, `lead`, `primaryCta`, `secondaryCta` |

`accentWord` follows the About page's rule exactly: it must appear inside
`title` verbatim, is rendered in the serif italic accent, and falls back to
plain text when blank or not found. The `01`, `02`, `03` numbering on pillars
and steps stays derived from position — it is never stored.

### 5.3 Actions

`src/lib/home-actions.ts`, mirroring
[about-actions.ts](../../../src/lib/about-actions.ts):

- `getHomeContent()` — `cache()`-wrapped, so the public page and the admin form
  can both call it without a second round trip. Returns `DEFAULT_HOME_CONTENT`
  when nothing is saved or the read throws.
- `saveHomeContent(data)` — `requireAdmin()`, `homeContentSchema.parse`,
  upsert on `key: "current"`, then `revalidatePath("/")` and
  `revalidatePath("/admin/home")`.

**Merge and repair (D8).** On read, each section's stored content is spread
over its defaults, and arrays fall back to the defaults when empty — the same
guard `getAboutContent()` applies to `cards`. The layout is then repaired:
unknown ids are dropped, ids missing from the stored layout are appended
visible, duplicates are collapsed, and `hero` is forced to index 0.

## 6. Rendering

[page.tsx](../../../src/app/(public)/page.tsx) becomes an async server
component that fetches content and events and hands both to
`src/components/layout/home-page-client.tsx` — the same split
[about/page.tsx](../../../src/app/(public)/about/page.tsx) uses.

This retires the client-side event fetch. Today the page loads, renders four
skeleton cards, then fills them from a `useEffect`; with the page already on
the server, `getUpcomingEvents()` runs there and the events arrive in the
initial HTML. The skeleton branch goes away with it. `GalleryStrip` and
`LeadershipRow` keep fetching their own data on the client — out of scope.

### 6.1 Registry

The registry is split in two, because Vitest runs in a `node` environment over
`tests/**/*.test.ts` only — a module that reaches a test may not import a
component. `src/lib/home-sections.ts` holds the pure metadata (admin label and
surface mode per id) and is imported by the layout helper, the tests and the
admin editor; `src/components/layout/home-sections.tsx` holds the id →
component map and is imported only by the client renderer.

Surface modes:

| Section | Surface mode |
|---|---|
| `hero` | `media` — black, pinned first |
| `about`, `events`, `gallery`, `committee`, `join` | `rotate` |
| `cta` | `deep` |

### 6.2 Surface rotation

`resolveSections(layout)` is a pure function exported from
`src/lib/home-layout.ts`. It filters to visible sections and returns, for each,
its id plus the `surface` and `tone` its component should receive:

- `media` → the hero's own black treatment; always first.
- `deep` → `surface-deep` with `tone="dark"`.
- `rotate` → base and tint alternate. Counting only rotating sections, even
  positions take the base `surface-1`; odd positions take a tint, and the tints
  themselves cycle `surface-2`, `surface-3`, `surface-2`, …

The alternation is not a three-way cycle, because the page is not built as one.
Today's order is about, events, gallery, committee, join on surfaces 1, 2, 1, 3,
1 — white with a tinted band every second section. `n % 3` would have produced
1, 2, 3, 1, 2 and quietly recoloured three sections before anyone edited
anything. Base-then-tint reproduces the current assignment exactly at the
default order, keeps two identical adjacent surfaces impossible by
construction, and holds for any permutation.

`resolveSections` also returns `bordered`, true for tinted sections only. That
reproduces the `border-y` the events band and the committee row draw today,
and it means a border always separates two different surfaces rather than
stacking into a 2px seam — the problem
[leadership-row.tsx](../../../src/components/layout/leadership-row.tsx)'s
`seamless` prop was added for. `seamless` stays as it is for the About page's
call site.

Being pure and returning plain data, it is tested without rendering anything.

### 6.3 Component changes

Each of the six section components gains a `content` prop plus optional
`surface`, `tone` and `bordered` props, **all defaulted to today's hardcoded
values**. The About page's `<LeadershipRow limit={0} showEmptyState seamless />`
therefore keeps working with no change at that call site.

The events band and the final CTA band currently live inline in `page.tsx`.
They move into `src/components/layout/events-band-section.tsx` and
`src/components/layout/join-cta.tsx` so that every entry in the registry is a
component of the same kind.

**The accent helper moves out.** `withAccent` is currently a local function
inside
[about-page-client.tsx](../../../src/components/layout/about-page-client.tsx);
seven home sections need it. The splitting becomes a pure
`splitOnAccent(text, accent) => { before, match, after }` in
`src/lib/accent.ts`, and the JSX wrapper that renders `match` inside `<Accent>`
moves to `src/components/layout/with-accent.tsx`. The About page imports it
instead of defining its own — behaviour identical, one implementation.

## 7. Admin editor

`src/app/admin/(dashboard)/home/page.tsx` is the About admin page with the
nouns changed: `requireAdminPage()`, `getHomeContent()`, render the editor.

`src/components/admin/home/home-content-editor.tsx` is one react-hook-form over
the whole document with a single Save button in the `PageHeader`, exactly as
[about-content-editor.tsx](../../../src/components/admin/about-content-editor.tsx)
does.

**Layout list.** `useFieldArray({ name: "layout" })`. Each entry renders a
collapsible card: the header carries the section's label from the registry, a
visibility toggle bound to `layout.${i}.visible`, and MoveUp/MoveDown buttons
calling `move()` — the same controls the About card editor already uses, so no
new dependency and no keyboard-inaccessible drag target. The hero's card shows
the toggle but no move buttons (D6). Cards start collapsed.

**Field paths.** Fields register under `content.<id>.*`, never under
`layout.${i}.*`. Because that path does not depend on position, moving a
section reorders the layout array alone and cannot remap a value.

**File layout.** The About editor is 233 lines for one section; seven sections
with nested arrays in one file would run past 800. Nested `useFieldArray` calls
(facts, pillars, steps) each need their own component regardless, so
`src/components/admin/home/` holds one small editor per section plus a shared
`SectionCard`. The `Field` helper is lifted out of the About editor into
`src/components/admin/ui/field.tsx` and both editors import it.

**Video upload.** [image-upload.tsx](../../../src/components/admin/image-upload.tsx)
gains an optional `accept` prop and renders a `<video>` preview when the value
is a video URL. `uploadImageAction` already validates video (mp4, quicktime,
webm, 100 MB) and uploads with `resource_type: "auto"`, so nothing changes
below the component.

## 8. Permissions and navigation

- `src/lib/permissions.ts` gains
  `"content.home.edit": { group: "Content", label: "Edit the Home page", mutates: true }`
  beside `content.about.edit`.
- The admin sidebar gains a "Home Page" item next to "About Page" in the
  Community group of
  [layout.tsx](<../../../src/app/admin/(dashboard)/layout.tsx>).
- Guards stay `requireAdminPage()` on the page and `requireAdmin()` in the save
  action until the RBAC branch converts every content action together (D10).

## 9. Testing

Vitest is already configured. New `tests/home-content.test.ts` covers:

1. `DEFAULT_HOME_CONTENT` validates against `homeContentSchema`.
2. A partial stored document merges over the defaults; an empty `pillars` array
   falls back to the default pillars.
3. Layout repair: unknown ids dropped, missing ids appended, duplicates
   collapsed, `hero` forced to index 0.
4. `resolveSections` at the default order returns exactly today's assignment —
   `surface-1`, `surface-2`, `surface-1`, `surface-3`, `surface-1` across
   about, events, gallery, committee, join, with `bordered` true for events and
   committee alone.
5. `resolveSections` over every permutation of the six movable sections — no
   two adjacent rotating sections share a surface, the hero is always `media`,
   and the CTA is always `deep` with `tone="dark"`.
6. `splitOnAccent`: an accent word found in the title splits into three parts;
   an accent word that is blank, absent from the title, or differs in case
   returns the whole title as `before` with no match — the plain-text
   fallback the About page already relies on.

## 10. File inventory

New:

- `prisma/schema.prisma` — `HomeContent` model (edit)
- `src/lib/home-schema.ts`
- `src/lib/home-icons.ts`
- `src/lib/home-actions.ts`
- `src/lib/home-layout.ts`
- `src/lib/home-sections.ts` — pure section metadata
- `src/lib/accent.ts`
- `src/components/layout/with-accent.tsx`
- `src/components/layout/home-page-client.tsx`
- `src/components/layout/home-sections.tsx` — id → component map
- `src/components/layout/events-band-section.tsx`
- `src/components/layout/join-cta.tsx`
- `src/components/admin/ui/field.tsx`
- `src/components/admin/home/` — `home-content-editor.tsx`, `section-card.tsx`,
  and one editor per section
- `src/app/admin/(dashboard)/home/page.tsx`
- `tests/home-content.test.ts`

Edited:

- `src/app/(public)/page.tsx` — becomes a server component
- `src/components/layout/hero.tsx`, `about-intro.tsx`, `gallery-strip.tsx`,
  `leadership-row.tsx`, `join-steps.tsx` — accept content and surface props
- `src/components/admin/image-upload.tsx` — video preview
- `src/components/admin/about-content-editor.tsx` — import the shared `Field`
- `src/components/layout/about-page-client.tsx` — import the shared `withAccent`
- `src/lib/permissions.ts`, `src/app/admin/(dashboard)/layout.tsx`

## 11. Risks

**Copy drift during extraction.** Seven sections of defaults are transcribed by
hand from six components. A dropped em dash is invisible in review and live on
the home page. Mitigation: extract each section's defaults and convert its
component in the same task, so the diff shows the old literal and the new
default side by side.

**The About page shares `LeadershipRow`.** Every new prop is defaulted to the
current hardcoded value (§6.3), and the About page's call site is left
untouched, so a regression there means a default is wrong rather than a call
site is missing.

**Nested field arrays.** `useFieldArray` inside a section component needs the
parent form's `control` passed down. Handled by keeping one `useForm` in
`home-content-editor.tsx` and threading `control` explicitly, rather than
reaching for `FormProvider` — the About editor establishes the explicit style.
