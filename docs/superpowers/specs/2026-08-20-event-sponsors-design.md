# Event Sponsors — Design

Date: 2026-08-20
Status: Approved for planning

## 1. Problem

Events sometimes have sponsors, but there's nowhere on the site to record or
show them. Admins have no field for it when creating/editing an event, and
visitors have no way to see who backed an event.

## 2. Goals

- Let an admin attach one or more sponsors (name, logo, optional website
  link) to an event when creating/editing it.
- Show sponsors on the event's own page.
- Give a lightweight signal on the event card/list that an event is
  sponsored, without cluttering the card with logos.
- Logo upload works exactly like every other image upload in the admin
  (same component, same validation, same Cloudinary pipeline) — nothing
  bespoke.

## 3. Non-goals

- A reusable/global sponsor directory. Sponsors are entered per event; the
  same company sponsoring two events is re-entered both times, not linked.
- Sponsor tiers (Gold/Silver/Bronze) or per-sponsor descriptions.
- Drag-and-drop reordering — the codebase has no drag library, and this
  matches the existing move-up/move-down pattern used elsewhere (e.g. Reels
  admin, per `2026-08-18-instagram-reels-design.md`).
- Sponsor logos on event cards — cards get a plain "Sponsored" text/icon
  badge only; logos are reserved for the event detail page.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | New `EventSponsor` model, one row per sponsor, related to `Event` one-to-many | Mirrors `GalleryAlbum` → `GalleryMedia`: a parent entity owning an ordered list of child records, the established pattern in this schema for this shape of data. |
| D2 | Sponsors are per-event only, no shared/global `Sponsor` table | Per user decision — simpler model, no cross-event linking needed. |
| D3 | Fields: `name` (required), `logoUrl` (required), `websiteUrl` (optional) | Covers the common case (who + what they look like + where to click) without unused fields (no tiers, no description — see §3). |
| D4 | Logo upload reuses the existing `<ImageUpload>` component and `uploadImageAction`, new Cloudinary folder `kerala-samajam/sponsors` | Per user's explicit requirement — logo upload must work like every other image upload. No new upload path. |
| D5 | Ordering via a `order: Int` field, controlled by move-up/move-down buttons in the admin form | Same reasoning as D-reels-equivalent: no drag library in this codebase; up/down arrows are the existing pattern for manually ordered lists. |
| D6 | Admin edits sponsors inline inside the existing event form modal (`event-form-modal.tsx`) via `useFieldArray`, not a separate screen | Sponsors are a property of one event, not an independent entity to manage — same reasoning as why they're not a global table (D2). One save commits the event and its sponsor list together. |
| D7 | `upsertEvent` syncs the sponsor list via Prisma nested writes (`deleteMany` + `create` under the relation) on every save | Simplest correct sync for a small, fully-replaced-on-save list; avoids diffing individual rows. Matches how this codebase already treats small owned child lists on parent save. |
| D8 | Event detail page shows a "Sponsors" section (logo strip) after the "Good to know" facts; each logo links to `websiteUrl` in a new tab when present, otherwise is static | Placement follows the existing content flow of `event-detail-client.tsx`; linking out only when a URL exists avoids dead/no-op links. |
| D9 | Event card shows a plain "Sponsored" text/icon badge when `sponsors.length > 0`, no logos | Per user decision — keeps cards clean; full sponsor detail belongs on the event page. |
| D10 | No new permission — sponsor edits are gated by the existing `requirePermission("events.edit")` on `upsertEvent` | Sponsors are edited as part of the event, not a separate resource; a separate permission would be unused granularity. |

## 5. Data model

MongoDB via Prisma — `prisma db push`, no migration file.

```prisma
model EventSponsor {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  name       String
  logoUrl    String
  websiteUrl String?
  order      Int      @default(0)
  eventId    String   @db.ObjectId
  event      Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

`Event` gains:

```prisma
model Event {
  ...
  sponsors  EventSponsor[]
}
```

### 5.1 Zod schema addition (`src/lib/schemas.ts`)

```ts
export const eventSponsorSchema = z.object({
  name: z.string().min(1, "Sponsor name is required"),
  logoUrl: z.string().url("Logo is required"),
  websiteUrl: z.string().url().optional().or(z.literal("")),
});

// added to eventSchema:
sponsors: z.array(eventSponsorSchema).default([]),
```

`EventFormValues` (inferred from `eventSchema`) picks this up automatically,
so `event-form-modal.tsx` and `upsertEvent` share the same shape as every
other field.

## 6. Admin form (`src/components/admin/event-form-modal.tsx`)

New "Sponsors" section, styled consistent with the existing "Image & Assets"
section, using `useFieldArray` on the `sponsors` field:

- Each row: `<ImageUpload>` for the logo (same component and
  `uploadImageAction` call as the event cover image, pointed at the
  `kerala-samajam/sponsors` Cloudinary folder), a name text input, an
  optional website URL text input, move-up/move-down buttons (swap `order`
  with the adjacent row), and a remove button.
- "+ Add sponsor" appends a blank row (empty name/logo, so it surfaces
  validation errors on submit until filled in — same UX as leaving any other
  required field blank).
- Submit validation (via `zodResolver(eventSchema)`) blocks save until every
  row has a name and a logo; `websiteUrl` is only checked for URL format if
  non-empty.

## 7. Server action (`src/lib/event-actions.ts`)

`upsertEvent`, inside the existing `requirePermission("events.edit")` gate:

1. `eventSchema.parse(input)` — validates `sponsors` along with everything
   else, as it already does for the rest of the form.
2. On create: `prisma.event.create({ data: { ..., sponsors: { create: sponsors.map((s, i) => ({ ...s, order: i })) } } })`.
3. On update: `prisma.event.update({ where: { id }, data: { ..., sponsors: { deleteMany: {}, create: sponsors.map((s, i) => ({ ...s, order: i })) } } })` — the full list is replaced on every save (D7), using the row order already submitted from the admin form rather than trusting a client-supplied `order` value.

No change to the cover-image upload path (`uploadToCloudinary` for
data-URL covers) — sponsor logos go through `uploadImageAction` client-side
before submit, same as the existing gallery-style image fields.

## 8. Public display

### 8.1 Event detail page (`event-detail-client.tsx`)

New "Sponsors" section placed after the "Good to know" facts list (and
before "Where"), rendered only when `event.sponsors.length > 0`:

- A horizontal wrap/grid of logos (`sponsors` ordered by `order`), each
  `<img>` with `alt={sponsor.name}`.
- If `sponsor.websiteUrl` is set, the logo is wrapped in
  `<a href={websiteUrl} target="_blank" rel="noopener noreferrer">`;
  otherwise it renders unwrapped (no dead link, no fake affordance).

### 8.2 Event card (`src/components/events/event-card.tsx`)

When `event.sponsors.length > 0`, render a small "Sponsored" text/icon badge
on the card. No logos, no sponsor names — just the signal (D9). Requires the
card's data fetch (wherever `event-card.tsx`/`events-client.tsx` loads
events for the list) to include a `sponsors` count or boolean, not full
sponsor rows, to avoid over-fetching for a badge.

## 9. Error handling

- Missing name/logo on a sponsor row: blocked at submit by
  `zodResolver(eventSchema)`, same inline error UX as other required fields
  in the form.
- Invalid `websiteUrl` format: blocked at submit the same way; empty string
  is treated as "no link," not an error.
- Logo upload failure: handled entirely by the existing `<ImageUpload>`
  component's own error/retry state — no new error path.
- An event with zero sponsors: both the detail-page section and the card
  badge simply don't render (guarded by `sponsors.length > 0`), no
  empty-state placeholder.

## 10. Testing

Vitest, matching existing `tests/` conventions:

- `eventSponsorSchema` / `eventSchema` — required name/logo, optional
  well-formed `websiteUrl`, empty string allowed for no link.
- `upsertEvent` (if existing tests cover it) — extend to assert sponsors are
  created on new events and fully replaced (old rows gone, new rows present
  with correct `order`) on update.
- Manual verification: add/reorder/remove sponsor rows in the admin form and
  save; confirm the detail page renders the logo strip in order with correct
  links, and the card shows the badge only when sponsors exist.

## 11. Open questions

None blocking.
