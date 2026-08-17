# Section Layout Parity Across Every Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every editable public page the home page's editor: sections that can be reordered, shown and hidden, with backgrounds derived from position rather than hardcoded.

**Architecture:** The machinery `home-layout.ts` already proves is generalised into `page-layout.ts`, parameterised by a per-page section-metadata map. Each page's document becomes `{layout, content}`; each page's client renders sections from a registry, the way `home-page-client.tsx` does; each editor uses the existing `SectionCard`.

**Tech Stack:** Next.js 16 App Router, Prisma + MongoDB, zod 4, react-hook-form 7, framer-motion 12, Tailwind 4, Vitest.

**Spec:** [2026-08-16-page-content-design.md](../specs/2026-08-16-page-content-design.md) — note this plan **deliberately reverses** that spec's non-goal "Section reordering or show/hide on the new pages", at the user's explicit direction after the trade-off was put to them.

## Two decisions taken before this plan, both with consequences

**1. Backgrounds are recomputed, and some sections change colour.** Fixed surfaces and arbitrary reordering are mutually exclusive. Every page adopts the home rotation: a white base, alternating cream (`surface-2`) and blush (`surface-3`) tints, media sections black, closing bands `surface-deep`. Contact's form section moves from `surface-1` to a tint; gallery's four separate dark bands collapse to one closing band. This is intended. Do not "preserve today's colours" — that is the thing being traded away.

**2. `listings` splits into `events` and `gallery`.** One document cannot carry a meaningful order across two pages. `PageContent` has no stored rows, so the split costs nothing.

## Global Constraints

- **Never use `.default()` in these zod schemas.** It makes input and output types diverge and `zodResolver` rejects it. Defaults are merged in by the read path.
- **Vitest runs in `node` and collects only `tests/**/*.test.ts`.** No JSX, and nothing a test imports may reach a React component or `@/lib/prisma`. Pure logic lives in `src/lib/*.ts`.
- **Do not change any default copy string.** Every one was transcribed character-for-character from the original components and verified by review. Layout changes colours and order, never words.
- **`AboutContent` has ONE stored row.** Restructuring its document to `{layout, content}` without a shape migration silently drops every stored field and reverts the live page to defaults. Task 3 owns this; do not skip it.
- **Feature gates keep winning.** `requireFeature()` calls in `gallery/page.tsx` and `membership/page.tsx` stay exactly where they are, and a switched-off module marks its section `visible: false` — see `src/app/(public)/page.tsx` for the established pattern.
- **Every section component must still render with no props**, defaulting to today's values, so a component used from elsewhere does not break.
- Commands: `npm test`, `npx tsc --noEmit -p tsconfig.json`, `npm run build`. Prisma: `npx prisma db push`, `npx prisma generate`.

---

### Task 1: Generalise the layout machinery

**Files:**
- Create: `src/lib/page-layout.ts`
- Modify: `src/lib/home-layout.ts` (re-export from the generic version), `tests/home-content.test.ts`
- Test: `tests/page-layout.test.ts`

**Interfaces:**
- Produces:
  - `SurfaceMode = "media" | "rotate" | "deep"`
  - `SectionMeta = { label: string; description: string; surfaceMode: SurfaceMode; movable: boolean }`
  - `LayoutEntry = { id: string; visible: boolean }`
  - `repairLayout<Id extends string>(ids: readonly Id[], meta: Record<Id, SectionMeta>, stored: unknown): LayoutEntry[]`
  - `resolveSections<Id extends string>(meta: Record<Id, SectionMeta>, layout: LayoutEntry[]): ResolvedSection[]`

Both functions are `home-layout.ts`'s, with the hardcoded `HOME_SECTION_IDS`/`HOME_SECTION_META` lifted into parameters. The pinning rule generalises too: `repairLayout` pins any section whose `movable` is `false` to its position in the canonical `ids` order, rather than hardcoding the hero.

- [ ] **Step 1: Write the failing test**

Create `tests/page-layout.test.ts`. Use a small fixture rather than a real page's metadata, so the test exercises the generic contract:

```ts
import { describe, expect, it } from "vitest";
import { repairLayout, resolveSections, type SectionMeta } from "@/lib/page-layout";

const IDS = ["banner", "story", "notes", "closing"] as const;

const META: Record<(typeof IDS)[number], SectionMeta> = {
  banner: { label: "Banner", description: "", surfaceMode: "media", movable: false },
  story: { label: "Story", description: "", surfaceMode: "rotate", movable: true },
  notes: { label: "Notes", description: "", surfaceMode: "rotate", movable: true },
  closing: { label: "Closing", description: "", surfaceMode: "deep", movable: true },
};

describe("repairLayout (generic)", () => {
  it("returns every id, visible, when nothing is stored", () => {
    expect(repairLayout(IDS, META, undefined)).toEqual([
      { id: "banner", visible: true },
      { id: "story", visible: true },
      { id: "notes", visible: true },
      { id: "closing", visible: true },
    ]);
  });

  it("appends ids missing from a stored layout, visible", () => {
    const repaired = repairLayout(IDS, META, [{ id: "banner", visible: true }]);

    expect(repaired.map((s) => s.id).sort()).toEqual([...IDS].sort());
    expect(repaired.find((s) => s.id === "notes")?.visible).toBe(true);
  });

  it("drops unknown ids and collapses duplicates, keeping the first", () => {
    const repaired = repairLayout(IDS, META, [
      { id: "story", visible: false },
      { id: "obsolete", visible: true },
      { id: "story", visible: true },
    ]);

    expect(repaired.map((s) => s.id)).not.toContain("obsolete");
    expect(repaired.filter((s) => s.id === "story")).toHaveLength(1);
    expect(repaired.find((s) => s.id === "story")?.visible).toBe(false);
  });

  it("pins an unmovable section to its canonical position, keeping its visibility", () => {
    const repaired = repairLayout(IDS, META, [
      { id: "story", visible: true },
      { id: "banner", visible: false },
    ]);

    expect(repaired[0]).toEqual({ id: "banner", visible: false });
  });
});

describe("resolveSections (generic)", () => {
  it("gives media and deep sections their fixed surfaces and dark type", () => {
    const resolved = resolveSections(META, repairLayout(IDS, META, undefined));

    expect(resolved.find((s) => s.id === "banner")).toMatchObject({
      surface: "bg-black",
      tone: "dark",
      bordered: false,
    });
    expect(resolved.find((s) => s.id === "closing")).toMatchObject({
      surface: "bg-surface-deep",
      tone: "dark",
    });
  });

  it("alternates base and tint across the rotating sections", () => {
    const resolved = resolveSections(META, repairLayout(IDS, META, undefined));

    expect(resolved.find((s) => s.id === "story")?.surface).toBe("bg-surface-1");
    expect(resolved.find((s) => s.id === "notes")?.surface).toBe("bg-surface-2");
    expect(resolved.find((s) => s.id === "notes")?.bordered).toBe(true);
  });

  it("skips hidden sections and re-bands what remains", () => {
    const resolved = resolveSections(META, [
      { id: "banner", visible: true },
      { id: "story", visible: false },
      { id: "notes", visible: true },
    ]);

    expect(resolved.map((s) => s.id)).toEqual(["banner", "notes"]);
    // notes is now the FIRST rotating section, so it takes the base surface.
    expect(resolved[1].surface).toBe("bg-surface-1");
    expect(resolved[1].bordered).toBe(false);
  });

  it("never puts two identical surfaces next to each other, in any order", () => {
    const movable = ["story", "notes", "closing"] as const;

    const permute = <T,>(items: readonly T[]): T[][] =>
      items.length <= 1
        ? [[...items]]
        : items.flatMap((item, i) =>
            permute([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest])
          );

    for (const order of permute(movable)) {
      const resolved = resolveSections(META, [
        { id: "banner", visible: true },
        ...order.map((id) => ({ id, visible: true })),
      ]);

      for (let i = 1; i < resolved.length; i++) {
        expect(resolved[i].surface, `${resolved[i - 1].id} → ${resolved[i].id}`).not.toBe(
          resolved[i - 1].surface
        );
      }
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- page-layout`
Expected: FAIL — `Failed to resolve import "@/lib/page-layout"`.

- [ ] **Step 3: Write `src/lib/page-layout.ts`**

Copy the two functions from `src/lib/home-layout.ts` and replace their references to `HOME_SECTION_IDS` and `HOME_SECTION_META` with the `ids` and `meta` parameters. Keep the existing comments — they explain why the append and the pinning exist — and generalise the hero-pinning comment to unmovable sections. Keep `TINTS` and the rotation arithmetic byte-identical; the home page's banding must not shift.

- [ ] **Step 4: Point `home-layout.ts` at it**

Rewrite `src/lib/home-layout.ts` to delegate, keeping its existing exported names so nothing that imports it changes:

```ts
import { repairLayout as repairGeneric, resolveSections as resolveGeneric, type ResolvedSection } from "./page-layout";
import { HOME_SECTION_IDS, type HomeContentT } from "./home-schema";
import { HOME_SECTION_META } from "./home-sections";

export type { ResolvedSection };

export const repairLayout = (stored: unknown): HomeContentT["layout"] =>
  repairGeneric(HOME_SECTION_IDS, HOME_SECTION_META, stored) as HomeContentT["layout"];

export const resolveSections = (layout: HomeContentT["layout"]) =>
  resolveGeneric(HOME_SECTION_META, layout);
```

- [ ] **Step 5: Prove the home page is unchanged**

Run: `npm test`
Expected: PASS. `tests/home-content.test.ts` already asserts the home page's exact surface sequence at the default order and the no-two-adjacent property across all 720 permutations — if the generalisation shifted anything, those fail. Do not modify that test to make it pass; if it fails, the refactor is wrong.

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`

```bash
git add src/lib/page-layout.ts src/lib/home-layout.ts tests/page-layout.test.ts
git commit -m "Generalise the section layout machinery for every page"
```

---

### Task 2: Split `listings` into `events` and `gallery`

**Files:**
- Create: `src/lib/page-content/events.ts`, `src/lib/page-content/gallery.ts`
- Delete: `src/lib/page-content/listings.ts`
- Modify: `src/lib/page-content/registry.ts`, `src/app/(public)/events/{page,events-client}.tsx`, `src/app/(public)/gallery/{page,gallery-landing-client}.tsx`, `src/app/admin/(dashboard)/pages/[slug]/page.tsx`, `src/app/admin/(dashboard)/layout-client.tsx`, `src/components/admin/pages/` (replace `listings-content-editor.tsx` with one editor per page), `tests/page-content.test.ts`

**Interfaces:**
- Produces: `eventsContentSchema`/`DEFAULT_EVENTS`/`EventsContentT`, `galleryContentSchema`/`DEFAULT_GALLERY`/`GalleryContentT`.

`DEFAULT_LISTINGS`'s six sections divide three and three: `eventsHero`/`eventsCalendar`/`eventsMembersBand` become the events document's `hero`/`calendar`/`membersBand`; `galleryHero`/`galleryAlbums`/`galleryContribute` become the gallery document's `hero`/`albums`/`contribute`. **Move the strings verbatim** — this task renames keys, it does not rewrite copy.

Two nav entries replace the one "Events & Gallery" entry, and the `listings` slug disappears from the registry. Since `PageContent` holds no rows, no migration is needed — but confirm that with a query before relying on it.

Detailed steps follow the shape of Task 3 below; the two documents are mechanical splits of an existing one.

---

### Task 3: Restructure a page document to `{layout, content}` — About first

**Files:**
- Modify: `src/lib/about-schema.ts`, `src/lib/about-actions.ts`, `src/components/layout/about-page-client.tsx`, `src/components/admin/about-content-editor.tsx`, `tests/page-layout.test.ts`
- Create: `src/lib/about-sections.ts`

About goes first because it is the only page with a stored row, so the migration is written and proven before four more documents depend on the same pattern.

**The migration.** `getAboutContent` currently spreads a stored document over `DEFAULT_ABOUT_CONTENT`. After the restructure the defaults are `{layout, content}`, so a stored flat document would contribute nothing recognisable and the live page would silently revert. The read path must detect the old shape and lift it:

```ts
// A document saved before sections were orderable has no `layout` key: its
// own keys ARE the content. Lift it rather than merging it against the new
// shape, where every field would read as unrecognised and be dropped —
// silently reverting a page an administrator had already edited.
const stored = record.value as Record<string, unknown>;
const isLegacy = !("layout" in stored) && !("content" in stored);
const content = isLegacy ? stored : stored.content;
const layout = isLegacy ? undefined : stored.layout;
```

Write a test for exactly this, with a realistic legacy document, before writing the code.

Then: `about-sections.ts` carries the section ids and `SectionMeta`; each section component in `about-page-client.tsx` takes `surface`/`tone`/`bordered` props defaulted to today's values; the page renders from `resolveSections`; and the editor switches to `SectionCard`.

Tasks 4–7 repeat this for contact, membership, events and gallery. None of them needs the legacy branch — but leave it in the shared read path, because the next document restructure will.

---

### Task 8: Final verification

- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` all clean; every affected route still `ƒ`.
- [ ] Delete every content row, reload all six public pages, confirm each renders its defaults with no error.
- [ ] Restore a legacy-shaped `AboutContent` row by hand and confirm the page still renders its stored copy, not the defaults.
- [ ] On each editor: collapse/expand, hide a section and confirm it vanishes from the public page with no gap and no two identical adjacent surfaces, reorder two sections and confirm the banding re-derives.
- [ ] Switch off the gallery and membership modules; confirm both pages still 404 despite stored content.
