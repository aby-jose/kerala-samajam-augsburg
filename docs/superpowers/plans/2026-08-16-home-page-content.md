# Editable Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every word, image, video and list on the home page editable from the admin portal, with sections that can be hidden and reordered.

**Architecture:** A single `HomeContent` JSON document holds an ordered `layout` array of `{id, visible}` and a `content` object keyed by section id. A pure helper resolves that layout into per-section background, tone and border props, so reordering can never break the page's alternating surfaces. The public page becomes a server component that fetches the document and hands it to a client renderer, exactly as the About page already works.

**Tech Stack:** Next.js 15 App Router, Prisma + MongoDB, zod 4, react-hook-form 7, framer-motion 12, Tailwind 4, Vitest, Cloudinary.

**Spec:** [docs/superpowers/specs/2026-08-16-home-page-content-design.md](../specs/2026-08-16-home-page-content-design.md)

## Global Constraints

- **Never use `.default()` in these zod schemas.** It makes the schema's input and output types diverge, which react-hook-form's `zodResolver` rejects. Defaults are merged in by `getHomeContent()` instead. This rule is already documented in [about-schema.ts](../../../src/lib/about-schema.ts).
- **Vitest runs in a `node` environment and only collects `tests/**/*.test.ts`.** No JSX, no component rendering, and no module that transitively imports a React component or `@/lib/prisma` may be imported by a test. Testable logic therefore lives in pure `src/lib/*.ts` modules.
- **Default copy must be transcribed character for character** from the component it replaces, em dashes and all. Every conversion task has an explicit diff step for this.
- **Every section component keeps working with no props.** Defaults on `content`, `surface`, `tone` and `bordered` reproduce today's hardcoded values, because [about-page-client.tsx](../../../src/components/layout/about-page-client.tsx) renders `LeadershipRow` and must not change.
- **Guards are `requireAdminPage()` on pages and `requireAdmin()` in actions**, matching the About page. Do not reach for `requirePermission()`; the RBAC branch converts every content action together.
- Commands: `npm test`, `npm run lint`, `npm run build`. Prisma: `npx prisma db push`, `npx prisma generate`.

---

### Task 1: Content schema and defaults

**Files:**
- Create: `src/lib/home-schema.ts`
- Test: `tests/home-content.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `HOME_SECTION_IDS` (readonly tuple of the 7 ids), `HomeSectionId`, `HOME_ICONS`, `homeContentSchema`, `HomeContentT`, `DEFAULT_HOME_CONTENT`, `mergeHomeContent(stored: unknown): HomeContentT["content"]`.

- [ ] **Step 1: Write the failing test**

Create `tests/home-content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_CONTENT,
  HOME_SECTION_IDS,
  homeContentSchema,
  mergeHomeContent,
} from "@/lib/home-schema";

describe("home content schema", () => {
  it("accepts the built-in defaults", () => {
    expect(() => homeContentSchema.parse(DEFAULT_HOME_CONTENT)).not.toThrow();
  });

  it("gives every section id a default content block", () => {
    for (const id of HOME_SECTION_IDS) {
      expect(DEFAULT_HOME_CONTENT.content[id], id).toBeTruthy();
    }
  });

  it("opens with the hero and lists every section exactly once", () => {
    expect(DEFAULT_HOME_CONTENT.layout[0].id).toBe("hero");
    expect(DEFAULT_HOME_CONTENT.layout.map((s) => s.id).sort()).toEqual(
      [...HOME_SECTION_IDS].sort()
    );
  });
});

describe("mergeHomeContent", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(mergeHomeContent(undefined)).toEqual(DEFAULT_HOME_CONTENT.content);
  });

  it("keeps stored fields and fills the rest from defaults", () => {
    const merged = mergeHomeContent({ hero: { headline: "Edited headline" } });

    expect(merged.hero.headline).toBe("Edited headline");
    expect(merged.hero.lead).toBe(DEFAULT_HOME_CONTENT.content.hero.lead);
    expect(merged.about).toEqual(DEFAULT_HOME_CONTENT.content.about);
  });

  it("falls back to the default list when a stored array is empty", () => {
    const merged = mergeHomeContent({
      about: { pillars: [] },
      join: { steps: [] },
    });

    expect(merged.about.pillars).toEqual(DEFAULT_HOME_CONTENT.content.about.pillars);
    expect(merged.join.steps).toEqual(DEFAULT_HOME_CONTENT.content.join.steps);
  });

  it("ignores section keys it does not recognise", () => {
    const merged = mergeHomeContent({ nonsense: { title: "x" } }) as Record<string, unknown>;
    expect(merged.nonsense).toBeUndefined();
  });

  it("produces something the schema still accepts", () => {
    const content = mergeHomeContent({ hero: { headline: "Edited headline" } });
    expect(() =>
      homeContentSchema.parse({ layout: DEFAULT_HOME_CONTENT.layout, content })
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- home-content`
Expected: FAIL — `Failed to resolve import "@/lib/home-schema"`.

- [ ] **Step 3: Write the schema**

Create `src/lib/home-schema.ts`. Copy the copy defaults **verbatim** from the components named in each comment.

```ts
import { z } from "zod";

/**
 * The home page as one editable document. `layout` owns order and visibility;
 * `content` owns the words and pictures, keyed by section id so a field path
 * never changes when a section moves — see lib/home-layout.ts for the
 * ordering rules and lib/home-sections.ts for what each id renders as.
 */
export const HOME_SECTION_IDS = [
  "hero",
  "about",
  "events",
  "gallery",
  "committee",
  "join",
  "cta",
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

/** Curated icon set for the "What we do" pillars, same contract as
 *  ABOUT_ICONS: a named tuple so the admin form offers a dropdown and the
 *  renderer never guesses whether a stored string is a real icon. */
export const HOME_ICONS = [
  "Flower2",
  "HeartHandshake",
  "Languages",
  "Music",
  "GraduationCap",
  "Users",
  "Utensils",
  "BookOpen",
] as const;

const linkSchema = z.object({
  label: z.string().min(1, "Label is required").max(60),
  href: z.string().min(1, "Link is required").max(200),
});

/** Eyebrow + title + accent + lead, repeated by every section below. */
const headingFields = {
  eyebrow: z.string().min(1, "Required").max(60),
  title: z.string().min(1, "Required").max(160),
  // Must appear inside `title` verbatim; rendered in the serif italic accent.
  // Plain text when blank or not found — see lib/accent.ts.
  accentWord: z.string().max(60).optional().or(z.literal("")),
  lead: z.string().min(1, "Required").max(500),
};

export const heroSectionSchema = z.object({
  badge: z.string().min(1, "Required").max(60),
  headline: z.string().min(1, "Required").max(160),
  accentWord: z.string().max(60).optional().or(z.literal("")),
  lead: z.string().min(1, "Required").max(500),
  primaryCta: linkSchema,
  secondaryCta: linkSchema,
  videoUrl: z.string().min(1, "A background video is required"),
  posterUrl: z.string().min(1, "A poster image is required"),
});

export const aboutSectionSchema = z.object({
  ...headingFields,
  facts: z
    .array(
      z.object({
        value: z.string().min(1, "Required").max(20),
        label: z.string().min(1, "Required").max(40),
      })
    )
    .min(2, "At least two facts are required")
    .max(4),
  storyLink: linkSchema,
  collage: z.object({
    primary: z.object({
      url: z.string().min(1, "An image is required"),
      alt: z.string().min(1, "Alt text is required").max(160),
      caption: z.string().max(60).optional().or(z.literal("")),
    }),
    secondary: z.object({
      url: z.string().min(1, "An image is required"),
      alt: z.string().min(1, "Alt text is required").max(160),
    }),
  }),
  quote: z.object({
    text: z.string().min(1, "Required").max(300),
    footnote: z.string().max(40).optional().or(z.literal("")),
  }),
  pillarsEyebrow: z.string().min(1, "Required").max(60),
  pillarsNote: z.string().min(1, "Required").max(120),
  pillars: z
    .array(
      z.object({
        icon: z.enum(HOME_ICONS),
        title: z.string().min(1, "Required").max(80),
        desc: z.string().min(1, "Required").max(300),
      })
    )
    .min(1, "At least one is required")
    .max(8),
});

export const eventsSectionSchema = z.object({
  ...headingFields,
  count: z.number().int().min(1).max(8),
  cta: linkSchema,
  empty: z.object({
    title: z.string().min(1, "Required").max(80),
    body: z.string().min(1, "Required").max(200),
  }),
});

export const gallerySectionSchema = z.object({
  ...headingFields,
  link: linkSchema,
});

export const committeeSectionSchema = z.object({
  ...headingFields,
  limit: z.number().int().min(1).max(24),
});

export const joinSectionSchema = z.object({
  ...headingFields,
  cta: linkSchema,
  steps: z
    .array(
      z.object({
        title: z.string().min(1, "Required").max(80),
        desc: z.string().min(1, "Required").max(300),
      })
    )
    .min(1, "At least one step is required")
    .max(6),
});

export const ctaSectionSchema = z.object({
  ...headingFields,
  primaryCta: linkSchema,
  secondaryCta: linkSchema,
});

export const homeContentSchema = z.object({
  layout: z
    .array(
      z.object({
        id: z.enum(HOME_SECTION_IDS),
        visible: z.boolean(),
      })
    )
    .min(1),
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

export type HomeContentT = z.infer<typeof homeContentSchema>;
export type HomeContentSections = HomeContentT["content"];

/**
 * The copy that lived hardcoded across six components before this editor
 * existed — used as the fallback until an admin saves their first edit, so
 * nothing changes visually on day one.
 */
export const DEFAULT_HOME_CONTENT: HomeContentT = {
  layout: [
    { id: "hero", visible: true },
    { id: "about", visible: true },
    { id: "events", visible: true },
    { id: "gallery", visible: true },
    { id: "committee", visible: true },
    { id: "join", visible: true },
    { id: "cta", visible: true },
  ],
  content: {
    // from components/layout/hero.tsx
    hero: {
      badge: "Kerala Samajam Augsburg",
      headline: "A home for Kerala in the heart of Augsburg",
      accentWord: "Kerala",
      lead: "The Malayali community in Bavaria — celebrating our culture, supporting each other, and building a home away from home since 2012.",
      primaryCta: { label: "Become a Member", href: "/membership" },
      secondaryCta: { label: "Upcoming Events", href: "/events" },
      videoUrl: "/hero.mp4",
      posterUrl: "/hero-poster.jpg",
    },
    // from components/layout/about-intro.tsx
    about: {
      eyebrow: "About us",
      title: "About Kerala Samajam Augsburg",
      accentWord: "Kerala",
      lead: "It started in 2012, when a handful of families cooked one Onam sadhya together. Today KSA is a registered Verein with members across Augsburg and the towns around it.",
      facts: [
        { value: "2012", label: "Founded" },
        { value: "e.V.", label: "Registered Verein" },
        { value: "Augsburg", label: "And the towns around" },
      ],
      storyLink: { label: "Read our full story", href: "/about" },
      collage: {
        primary: {
          url: "/images/gallery/kerala_sadya.png",
          alt: "An Onam sadhya served on a banana leaf",
          caption: "The sadhya it started with",
        },
        secondary: {
          url: "/images/about/hero.png",
          alt: "A lit nilavilakku, the traditional Kerala lamp",
        },
      },
      quote: {
        text: "Still cooking, still teaching the language, and still answering the phone when someone new needs a hand.",
        footnote: "Since 2012",
      },
      pillarsEyebrow: "What we do",
      pillarsNote: "Run by members, all year round.",
      pillars: [
        {
          icon: "Flower2",
          title: "Festivals and Celebrations",
          desc: "Onam, Vishu, Christmas and Deepavali — cooked and run by members, every year.",
        },
        {
          icon: "HeartHandshake",
          title: "Help Settling In",
          desc: "Anmeldung, flats, schools, insurance. Ask, and someone who has done it will help.",
        },
        {
          icon: "Languages",
          title: "Malayalam Classes",
          desc: "Weekend lessons so children born here keep speaking the language at home.",
        },
        {
          icon: "Music",
          title: "Music, Dance and Theatre",
          desc: "Classical dance, chenda and stage productions. No audition needed.",
        },
        {
          icon: "GraduationCap",
          title: "Study and Work Guidance",
          desc: "Ausbildung, applications and interviews, from members who have been through it.",
        },
        {
          icon: "Users",
          title: "Part of the City",
          desc: "Augsburg's cultural calendar and charity drives, open to everyone.",
        },
      ],
    },
    // from the events band inline in app/(public)/page.tsx
    events: {
      eyebrow: "Events",
      title: "Upcoming Events",
      accentWord: "Events",
      lead: "Everything on the calendar right now. Members hear about new dates first, and everyone is welcome at most of them.",
      count: 4,
      cta: { label: "Full Calendar", href: "/events" },
      empty: {
        title: "Nothing on the calendar just yet",
        body: "New dates are announced here first — members hear about them by email.",
      },
    },
    // from components/layout/gallery-strip.tsx
    gallery: {
      eyebrow: "Gallery",
      title: "Photo Gallery",
      accentWord: "Gallery",
      lead: "Every sadhya, every stage and every picnic since 2012 — photographed by whoever had a camera that day. Search by face to find yourself in there.",
      link: { label: "View all albums", href: "/gallery" },
    },
    // from components/layout/leadership-row.tsx
    committee: {
      eyebrow: "Committee",
      title: "Our Committee",
      accentWord: "Committee",
      lead: "The volunteers who run KSA this year — with day jobs, families, and a shared stubbornness about keeping this going.",
      limit: 8,
    },
    // from components/layout/join-steps.tsx
    join: {
      eyebrow: "Membership",
      title: "How to Become a Member",
      accentWord: "Member",
      lead: "Three steps and one yearly fee, which pays for the halls, the sound system and the rice. Pay by card, or in cash at the next event.",
      cta: { label: "View All Plans", href: "/membership" },
      steps: [
        {
          title: "Choose a Plan",
          desc: "Individual, family or student — whichever fits your household. One fee covers the full year.",
        },
        {
          title: "Fill in the Form",
          desc: "Your name, where in or around Augsburg you live, and who is joining along with you.",
        },
        {
          title: "Get Your Confirmation",
          desc: "The committee reviews your application and sends your welcome email. After that you are on the list for everything.",
        },
      ],
    },
    // from the join band inline in app/(public)/page.tsx
    cta: {
      eyebrow: "Join us",
      title: "Become a Member of KSA",
      accentWord: "KSA",
      lead: "Join the families who keep this going — and get every invitation, every class and every celebration for the year ahead.",
      primaryCta: { label: "Apply for Membership", href: "/membership" },
      secondaryCta: { label: "Ask a Question First", href: "/contact" },
    },
  },
};

/** Arrays that must never be left empty by a stored document — an admin who
 *  deletes every pillar gets the defaults back rather than a bare page. */
const LIST_FALLBACKS = {
  about: ["facts", "pillars"],
  join: ["steps"],
} as const;

/**
 * Spread each stored section over its defaults, so a document saved before a
 * field existed keeps rendering. Unknown section keys are dropped; empty
 * arrays fall back to the defaults. Pure and prisma-free so tests can import
 * it — see getHomeContent() in lib/home-actions.ts for the caller.
 */
export function mergeHomeContent(stored: unknown): HomeContentSections {
  const source = (stored ?? {}) as Record<string, Record<string, unknown>>;

  const merged = {} as HomeContentSections;

  for (const id of HOME_SECTION_IDS) {
    const defaults = DEFAULT_HOME_CONTENT.content[id] as Record<string, unknown>;
    const section = { ...defaults, ...(source[id] ?? {}) };

    for (const key of (LIST_FALLBACKS as Record<string, readonly string[]>)[id] ?? []) {
      const value = section[key];
      if (!Array.isArray(value) || value.length === 0) section[key] = defaults[key];
    }

    (merged as Record<string, unknown>)[id] = section;
  }

  return merged;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- home-content`
Expected: PASS, 8 tests.

- [ ] **Step 5: Diff the defaults against the components**

Open each of `hero.tsx`, `about-intro.tsx`, `gallery-strip.tsx`, `leadership-row.tsx`, `join-steps.tsx` and `app/(public)/page.tsx` beside the defaults you just wrote, and confirm every string matches character for character — em dashes (`—`), the apostrophe in `Augsburg's`, and `e.V.` included. This is the one step that cannot be caught by a test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/home-schema.ts tests/home-content.test.ts
git commit -m "Add home page content schema with today's copy as defaults"
```

---

### Task 2: Section metadata and layout resolution

**Files:**
- Create: `src/lib/home-sections.ts`, `src/lib/home-layout.ts`
- Modify: `tests/home-content.test.ts`

**Interfaces:**
- Consumes: `HOME_SECTION_IDS`, `HomeSectionId`, `HomeContentT` from Task 1.
- Produces:
  - `HOME_SECTION_META: Record<HomeSectionId, { label: string; description: string; surfaceMode: "media" | "rotate" | "deep"; movable: boolean }>`
  - `repairLayout(stored: unknown): HomeContentT["layout"]`
  - `resolveSections(layout: HomeContentT["layout"]): ResolvedSection[]` where `ResolvedSection = { id: HomeSectionId; surface: string; tone: "surface" | "dark"; bordered: boolean }`

- [ ] **Step 1: Write the failing test**

Append to `tests/home-content.test.ts`:

```ts
import { repairLayout, resolveSections } from "@/lib/home-layout";

describe("repairLayout", () => {
  it("returns the default layout when nothing is stored", () => {
    expect(repairLayout(undefined)).toEqual(DEFAULT_HOME_CONTENT.layout);
  });

  it("appends sections missing from a stored layout, visible", () => {
    const repaired = repairLayout([
      { id: "hero", visible: true },
      { id: "cta", visible: false },
    ]);

    expect(repaired.map((s) => s.id)).toContain("gallery");
    expect(repaired.find((s) => s.id === "gallery")?.visible).toBe(true);
    expect(repaired.find((s) => s.id === "cta")?.visible).toBe(false);
    expect(repaired).toHaveLength(7);
  });

  it("drops ids it does not recognise and collapses duplicates", () => {
    const repaired = repairLayout([
      { id: "hero", visible: true },
      { id: "obsolete", visible: true },
      { id: "join", visible: false },
      { id: "join", visible: true },
    ]);

    expect(repaired.map((s) => s.id)).not.toContain("obsolete");
    expect(repaired.filter((s) => s.id === "join")).toHaveLength(1);
    expect(repaired.find((s) => s.id === "join")?.visible).toBe(false);
  });

  it("forces the hero to the top wherever it was stored", () => {
    const repaired = repairLayout([
      { id: "join", visible: true },
      { id: "hero", visible: false },
    ]);

    expect(repaired[0].id).toBe("hero");
    expect(repaired[0].visible).toBe(false);
  });
});

describe("resolveSections", () => {
  it("reproduces today's surfaces at the default order", () => {
    const resolved = resolveSections(DEFAULT_HOME_CONTENT.layout);

    expect(resolved.map((s) => [s.id, s.surface])).toEqual([
      ["hero", "bg-black"],
      ["about", "bg-surface-1"],
      ["events", "bg-surface-2"],
      ["gallery", "bg-surface-1"],
      ["committee", "bg-surface-3"],
      ["join", "bg-surface-1"],
      ["cta", "bg-surface-deep"],
    ]);

    expect(resolved.filter((s) => s.bordered).map((s) => s.id)).toEqual([
      "events",
      "committee",
    ]);
  });

  it("gives the hero and the CTA band dark type", () => {
    const resolved = resolveSections(DEFAULT_HOME_CONTENT.layout);
    expect(resolved.find((s) => s.id === "hero")?.tone).toBe("dark");
    expect(resolved.find((s) => s.id === "cta")?.tone).toBe("dark");
    expect(resolved.find((s) => s.id === "about")?.tone).toBe("surface");
  });

  it("skips hidden sections", () => {
    const resolved = resolveSections([
      { id: "hero", visible: true },
      { id: "about", visible: false },
      { id: "events", visible: true },
    ]);

    expect(resolved.map((s) => s.id)).toEqual(["hero", "events"]);
    // events is now the first rotating section, so it takes the base surface
    expect(resolved[1].surface).toBe("bg-surface-1");
    expect(resolved[1].bordered).toBe(false);
  });

  it("never puts two identical surfaces next to each other, in any order", () => {
    const movable = ["about", "events", "gallery", "committee", "join", "cta"] as const;

    const permute = <T,>(items: readonly T[]): T[][] =>
      items.length <= 1
        ? [[...items]]
        : items.flatMap((item, i) =>
            permute([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
              item,
              ...rest,
            ])
          );

    for (const order of permute(movable)) {
      const resolved = resolveSections([
        { id: "hero", visible: true },
        ...order.map((id) => ({ id, visible: true })),
      ]);

      for (let i = 1; i < resolved.length; i++) {
        expect(
          resolved[i].surface,
          `${resolved[i - 1].id} → ${resolved[i].id}`
        ).not.toBe(resolved[i - 1].surface);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- home-content`
Expected: FAIL — `Failed to resolve import "@/lib/home-layout"`.

- [ ] **Step 3: Write the metadata**

Create `src/lib/home-sections.ts`. Pure metadata only — no component imports, so the layout helper and the tests can read it.

```ts
import { HOME_SECTION_IDS, type HomeSectionId } from "./home-schema";

/**
 * How each section behaves on the page and how it is labelled in the admin
 * editor. Kept free of component imports so lib/home-layout.ts and the tests
 * can import it under Vitest's node environment — the id → component map
 * lives in components/layout/home-sections.tsx.
 */
export type SurfaceMode = "media" | "rotate" | "deep";

export const HOME_SECTION_META: Record<
  HomeSectionId,
  { label: string; description: string; surfaceMode: SurfaceMode; movable: boolean }
> = {
  hero: {
    label: "Hero",
    description: "The full-height video banner at the top of the page.",
    surfaceMode: "media",
    // A full-height autoplaying video mid-page is not a layout the rest of
    // the design supports, and the navbar renders transparent over it.
    movable: false,
  },
  about: {
    label: "Who we are",
    description: "The story, the facts, the collage and the six things KSA does.",
    surfaceMode: "rotate",
    movable: true,
  },
  events: {
    label: "Upcoming events",
    description: "The next events from the calendar.",
    surfaceMode: "rotate",
    movable: true,
  },
  gallery: {
    label: "Photo gallery",
    description: "The mosaic of recent photographs.",
    surfaceMode: "rotate",
    movable: true,
  },
  committee: {
    label: "Committee",
    description: "This year's committee members.",
    surfaceMode: "rotate",
    movable: true,
  },
  join: {
    label: "How to join",
    description: "The three membership steps.",
    surfaceMode: "rotate",
    movable: true,
  },
  cta: {
    label: "Membership call to action",
    description: "The dark band that closes the page.",
    surfaceMode: "deep",
    movable: true,
  },
};

/** Section ids in the order the editor lists them when nothing is stored. */
export const DEFAULT_SECTION_ORDER: readonly HomeSectionId[] = HOME_SECTION_IDS;
```

- [ ] **Step 4: Write the layout helper**

Create `src/lib/home-layout.ts`:

```ts
import {
  DEFAULT_HOME_CONTENT,
  HOME_SECTION_IDS,
  type HomeContentT,
  type HomeSectionId,
} from "./home-schema";
import { HOME_SECTION_META } from "./home-sections";

export type ResolvedSection = {
  id: HomeSectionId;
  surface: string;
  tone: "surface" | "dark";
  bordered: boolean;
};

const isSectionId = (value: unknown): value is HomeSectionId =>
  typeof value === "string" && (HOME_SECTION_IDS as readonly string[]).includes(value);

/**
 * Make any stored layout renderable: drop ids we no longer ship, collapse
 * duplicates keeping the first, append sections added since the document was
 * saved (visible, at the end), and pin the hero to the top.
 *
 * Without the append, a section introduced in a later release would be
 * invisible on every site that had already saved once.
 */
export function repairLayout(stored: unknown): HomeContentT["layout"] {
  const entries = Array.isArray(stored) ? stored : [];
  const seen = new Set<HomeSectionId>();
  const repaired: HomeContentT["layout"] = [];

  for (const entry of entries) {
    const id = (entry as { id?: unknown })?.id;
    if (!isSectionId(id) || seen.has(id)) continue;

    seen.add(id);
    repaired.push({ id, visible: (entry as { visible?: unknown }).visible !== false });
  }

  for (const id of HOME_SECTION_IDS) {
    if (!seen.has(id)) repaired.push({ id, visible: true });
  }

  const heroIndex = repaired.findIndex((s) => s.id === "hero");
  if (heroIndex > 0) repaired.unshift(...repaired.splice(heroIndex, 1));

  return repaired.length ? repaired : [...DEFAULT_HOME_CONTENT.layout];
}

/**
 * Background, type tone and border for each visible section, derived from
 * position rather than stored.
 *
 * The rotating sections alternate a white base with a tinted band, and the
 * tints themselves alternate cream and blush. At the default order that
 * reproduces today's page exactly — 1, 2, 1, 3, 1 across about, events,
 * gallery, committee and join — and in any order it keeps two identical
 * surfaces from ever landing next to each other. Borders belong to the
 * tinted bands, so a rule always separates two different colours.
 */
const TINTS = ["bg-surface-2", "bg-surface-3"] as const;

export function resolveSections(layout: HomeContentT["layout"]): ResolvedSection[] {
  let rotatingIndex = 0;

  return layout
    .filter((section) => section.visible)
    .map(({ id }) => {
      const { surfaceMode } = HOME_SECTION_META[id];

      if (surfaceMode === "media") {
        return { id, surface: "bg-black", tone: "dark" as const, bordered: false };
      }

      if (surfaceMode === "deep") {
        return { id, surface: "bg-surface-deep", tone: "dark" as const, bordered: false };
      }

      const position = rotatingIndex++;
      const isTinted = position % 2 === 1;

      return {
        id,
        surface: isTinted ? TINTS[((position - 1) / 2) % TINTS.length] : "bg-surface-1",
        tone: "surface" as const,
        bordered: isTinted,
      };
    });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- home-content`
Expected: PASS. The permutation test exercises 720 orders; if any adjacent pair matches, the failure message names the two sections.

- [ ] **Step 6: Commit**

```bash
git add src/lib/home-sections.ts src/lib/home-layout.ts tests/home-content.test.ts
git commit -m "Resolve home section surfaces from layout position"
```

---

### Task 3: Shared accent helper

**Files:**
- Create: `src/lib/accent.ts`, `src/components/layout/with-accent.tsx`
- Modify: `src/components/layout/about-page-client.tsx:14-31`
- Test: `tests/home-content.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `splitOnAccent(text: string, accent?: string): { before: string; match: string; after: string }` and the `withAccent(text: string, accent?: string): React.ReactNode` component helper.

- [ ] **Step 1: Write the failing test**

Append to `tests/home-content.test.ts`:

```ts
import { splitOnAccent } from "@/lib/accent";

describe("splitOnAccent", () => {
  it("splits a title around the accent word", () => {
    expect(splitOnAccent("A home for Kerala in Augsburg", "Kerala")).toEqual({
      before: "A home for ",
      match: "Kerala",
      after: " in Augsburg",
    });
  });

  it("returns the whole title when the accent is blank", () => {
    expect(splitOnAccent("Upcoming Events", "")).toEqual({
      before: "Upcoming Events",
      match: "",
      after: "",
    });
  });

  it("returns the whole title when the accent is absent or differs in case", () => {
    expect(splitOnAccent("Upcoming Events", "Missing").match).toBe("");
    expect(splitOnAccent("Upcoming Events", "events").match).toBe("");
  });

  it("splits on the first occurrence only", () => {
    expect(splitOnAccent("Events after Events", "Events")).toEqual({
      before: "",
      match: "Events",
      after: " after Events",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- home-content`
Expected: FAIL — `Failed to resolve import "@/lib/accent"`.

- [ ] **Step 3: Write the pure splitter**

Create `src/lib/accent.ts`:

```ts
/**
 * Split `text` on the first occurrence of `accent`. `match` is empty when the
 * accent is blank or not found, which is the signal to render plain text —
 * admin-entered copy must never crash a page.
 *
 * Kept free of JSX so it can be unit tested under Vitest's node environment;
 * the rendering half lives in components/layout/with-accent.tsx.
 */
export function splitOnAccent(text: string, accent?: string) {
  if (!accent) return { before: text, match: "", after: "" };

  const index = text.indexOf(accent);
  if (index === -1) return { before: text, match: "", after: "" };

  return {
    before: text.slice(0, index),
    match: accent,
    after: text.slice(index + accent.length),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- home-content`
Expected: PASS.

- [ ] **Step 5: Write the rendering half**

Create `src/components/layout/with-accent.tsx`:

```tsx
import { splitOnAccent } from "@/lib/accent";
import { Accent } from "@/components/layout/section-heading";

/** Wraps the accent slice of `text` in <Accent>, falling back to plain text
 *  when the accent word is blank or absent. */
export function withAccent(text: string, accent?: string) {
  const { before, match, after } = splitOnAccent(text, accent);
  if (!match) return text;

  return (
    <>
      {before}
      <Accent>{match}</Accent>
      {after}
    </>
  );
}
```

- [ ] **Step 6: Point the About page at it**

In `src/components/layout/about-page-client.tsx`, delete the local `withAccent` function (the block at lines 14–31, comment included) and import the shared one instead. Leave both call sites — `withAccent(content.title, content.accentWord)` and `withAccent(content.storyTitle, content.storyAccentWord)` — exactly as they are.

```tsx
import { withAccent } from "@/components/layout/with-accent";
```

If `Accent` is now unused in that file, drop it from the `section-heading` import; if other JSX still uses it, keep it. Run `npm run lint` to find out rather than guessing.

- [ ] **Step 7: Verify nothing moved on the About page**

Run: `npm run lint && npm run build`
Expected: both pass. Then `npm run dev`, open `/about`, and confirm "About **Kerala** Samajam Augsburg" and "Where We **Come From**" still render their accent word in serif italic primary.

- [ ] **Step 8: Commit**

```bash
git add src/lib/accent.ts src/components/layout/with-accent.tsx src/components/layout/about-page-client.tsx tests/home-content.test.ts
git commit -m "Extract the accent splitter so both pages share one implementation"
```

---

### Task 4: Database model and server actions

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/home-actions.ts`

**Interfaces:**
- Consumes: `mergeHomeContent`, `homeContentSchema`, `HomeContentT`, `DEFAULT_HOME_CONTENT` (Task 1); `repairLayout` (Task 2).
- Produces: `getHomeContent(): Promise<HomeContentT>` and `saveHomeContent(data: HomeContentT): Promise<{ success: true }>`.

- [ ] **Step 1: Add the model**

In `prisma/schema.prisma`, directly below the `AboutContent` model:

```prisma
model HomeContent {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  key       String   @unique @default("current")
  value     Json     // Stores HomeContentT — see lib/home-schema.ts
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Push the schema and regenerate the client**

Run: `npx prisma db push && npx prisma generate`
Expected: "Your database is now in sync with your Prisma schema", then a generated client. `prisma.homeContent` now exists in types.

- [ ] **Step 3: Write the actions**

Create `src/lib/home-actions.ts`:

```ts
"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";

import { prisma } from "./prisma";
import { requireAdmin } from "./guards";
import {
  DEFAULT_HOME_CONTENT,
  homeContentSchema,
  mergeHomeContent,
  type HomeContentT,
} from "./home-schema";
import { repairLayout } from "./home-layout";

/**
 * The live home page document, or the built-in defaults if nothing has been
 * saved yet. Deduped per request like getAboutContent() — the public page and
 * the admin form can both call it without a duplicate DB round trip.
 */
export const getHomeContent = cache(async (): Promise<HomeContentT> => {
  try {
    const record = await prisma.homeContent.findUnique({ where: { key: "current" } });
    if (!record || !record.value) return DEFAULT_HOME_CONTENT;

    const stored = record.value as { layout?: unknown; content?: unknown };

    return {
      layout: repairLayout(stored.layout),
      content: mergeHomeContent(stored.content),
    };
  } catch (error) {
    console.error("Home content fetch error:", error);
    return DEFAULT_HOME_CONTENT;
  }
});

export async function saveHomeContent(data: HomeContentT) {
  await requireAdmin();

  const validated = homeContentSchema.parse({
    ...data,
    layout: repairLayout(data.layout),
  });

  try {
    await prisma.homeContent.upsert({
      where: { key: "current" },
      update: { value: validated as any },
      create: { key: "current", value: validated as any },
    });

    revalidatePath("/");
    revalidatePath("/admin/home");
    return { success: true };
  } catch (error) {
    console.error("Failed to save home content:", error);
    throw new Error("Failed to save Home page content");
  }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run lint && npm run build`
Expected: both pass. Nothing imports these actions yet, so there is nothing to see in the browser — Task 6 is the first render.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/home-actions.ts
git commit -m "Add HomeContent model with cached read and admin save"
```

---

### Task 5: Extract the two inline bands into components

**Files:**
- Create: `src/components/layout/events-band-section.tsx`, `src/components/layout/join-cta.tsx`
- Modify: `src/app/(public)/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `<EventsBandSection events={...} />` and `<JoinCta />`. Both still carry hardcoded copy; Tasks 9 and 12 give them content props.

This is a pure refactor. The rendered page must be identical afterwards.

- [ ] **Step 1: Move the events band**

Create `src/components/layout/events-band-section.tsx` as a `"use client"` component holding the `<section>` currently at `page.tsx:75-135` — heading block, "Full Calendar" button, loading skeleton, `<EventsShowcase />` and the empty state. Give it this interface, keeping every class name and string exactly as it is today:

```tsx
"use client";

// Exported so home-page-client.tsx types its `events` prop from one place.
export interface EventCard {
  id: string;
  slug: string;
  title: string;
  date: string;
  location: string;
  description: string;
  image: string;
}

export function EventsBandSection({
  events,
  isLoading = false,
}: {
  events: EventCard[];
  isLoading?: boolean;
}) {
  // …the section markup moved verbatim from page.tsx, with `upcomingEvents`
  // renamed to `events` and `isLoadingEvents` renamed to `isLoading`.
}
```

Move `revealVariants` into this file too — it is declared in `page.tsx` and used by both bands, so each new component gets its own copy rather than importing across.

- [ ] **Step 2: Move the join band**

Create `src/components/layout/join-cta.tsx` as a `"use client"` component holding the `<section>` currently at `page.tsx:147-202` — the glow, the dot grid, the heading and the two buttons. No props yet:

```tsx
"use client";

export function JoinCta() {
  // …the section markup moved verbatim from page.tsx.
}
```

- [ ] **Step 3: Use them from the page**

In `src/app/(public)/page.tsx`, replace the two inline `<section>` blocks with `<EventsBandSection events={upcomingEvents} isLoading={isLoadingEvents} />` and `<JoinCta />`. Remove the imports that are now unused — `Container`, `Eyebrow`, `SectionTitle`, `SectionLead`, `Accent`, `Button`, `ArrowRight`, `Link`, `EventsShowcase`, `motion`, `Variants`. The page keeps its `"use client"` directive and its `useEffect` for now; Task 6 changes that.

- [ ] **Step 4: Verify the page is unchanged**

Run: `npm run lint && npm run build`, then `npm run dev` and open `/`. Confirm: the events band still shows four skeleton cards then fills them, the "Full Calendar" button works, and the dark join band at the bottom looks exactly as before — same glow, same dot grid, same two buttons.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/events-band-section.tsx src/components/layout/join-cta.tsx "src/app/(public)/page.tsx"
git commit -m "Extract the events and join bands from the home page"
```

---

### Task 6: Server page, client renderer and surface props

**Files:**
- Modify: `src/app/(public)/page.tsx` (rewritten), `src/components/layout/hero.tsx`, `about-intro.tsx`, `gallery-strip.tsx`, `leadership-row.tsx`, `join-steps.tsx`, `events-band-section.tsx`, `join-cta.tsx`
- Create: `src/components/layout/home-page-client.tsx`, `src/components/layout/home-sections.tsx`

**Interfaces:**
- Consumes: `getHomeContent` (Task 4), `resolveSections`/`ResolvedSection` (Task 2), the two components from Task 5.
- Produces: `HOME_SECTION_COMPONENTS: Record<HomeSectionId, React.ComponentType<HomeSectionProps>>` and the `HomeSectionProps` shape every section component now accepts:

```ts
interface HomeSectionProps {
  surface?: string;      // a bg-* class
  tone?: "surface" | "dark";
  bordered?: boolean;
  events?: EventCard[];  // events band only
}
```

Content props arrive in Tasks 7–12. This task only moves the page onto the server and lets position drive the backgrounds.

- [ ] **Step 1: Give each section component its surface props**

In each of `hero.tsx`, `about-intro.tsx`, `gallery-strip.tsx`, `join-steps.tsx`, `events-band-section.tsx` and `join-cta.tsx`, replace the hardcoded background class on the outer `<section>` with a prop that defaults to today's value. For example, in `gallery-strip.tsx`:

```tsx
export function GalleryStrip({
  surface = "bg-surface-1",
  bordered = false,
}: {
  surface?: string;
  bordered?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden py-24 md:py-32",
        surface,
        bordered && "border-y border-border"
      )}
    >
```

Defaults per component, matching what is there today: `hero.tsx` → `bg-black` (leave its own `isolate`/`h-svh` classes alone); `about-intro.tsx`, `gallery-strip.tsx`, `join-steps.tsx` → `bg-surface-1`, `bordered = false`; `events-band-section.tsx` → `bg-surface-2`, `bordered = true`; `join-cta.tsx` → `bg-surface-deep`, `bordered = false`.

`leadership-row.tsx` already takes props. Add `surface = "bg-surface-3"` and `bordered = true` to its signature and fold them into its existing `cn(...)` call, keeping `seamless` working exactly as it does — the About page passes it and must not change:

```tsx
className={cn(
  "relative overflow-hidden py-24 md:py-32",
  surface,
  bordered && "border-b border-border",
  bordered && !seamless && "border-t",
  className
)}
```

- [ ] **Step 2: Write the component registry**

Create `src/components/layout/home-sections.tsx`:

```tsx
import type { HomeSectionId } from "@/lib/home-schema";
import { Hero } from "@/components/layout/hero";
import { AboutIntro } from "@/components/layout/about-intro";
import { EventsBandSection } from "@/components/layout/events-band-section";
import { GalleryStrip } from "@/components/layout/gallery-strip";
import { LeadershipRow } from "@/components/layout/leadership-row";
import { JoinSteps } from "@/components/layout/join-steps";
import { JoinCta } from "@/components/layout/join-cta";

/** Which component renders each section id. The admin labels and surface
 *  modes live in lib/home-sections.ts, which stays free of imports like
 *  these so the tests can read it. */
export const HOME_SECTION_COMPONENTS: Record<HomeSectionId, React.ComponentType<any>> = {
  hero: Hero,
  about: AboutIntro,
  events: EventsBandSection,
  gallery: GalleryStrip,
  committee: LeadershipRow,
  join: JoinSteps,
  cta: JoinCta,
};
```

- [ ] **Step 3: Write the client renderer**

Create `src/components/layout/home-page-client.tsx`:

```tsx
"use client";

import { resolveSections } from "@/lib/home-layout";
import type { HomeContentT } from "@/lib/home-schema";
import { HOME_SECTION_COMPONENTS } from "@/components/layout/home-sections";
import type { EventCard } from "@/components/layout/events-band-section";

export function HomePageClient({
  content,
  events,
}: {
  content: HomeContentT;
  events: EventCard[];
}) {
  const sections = resolveSections(content.layout);

  return (
    <main className="min-h-screen flex flex-col bg-background">
      {sections.map(({ id, surface, tone, bordered }) => {
        const Section = HOME_SECTION_COMPONENTS[id];

        return (
          <Section
            key={id}
            surface={surface}
            tone={tone}
            bordered={bordered}
            {...(id === "events" ? { events } : {})}
          />
        );
      })}
    </main>
  );
}
```

- [ ] **Step 4: Rewrite the page as a server component**

Replace `src/app/(public)/page.tsx` entirely. The `"use client"` directive, the `useState`/`useEffect` pair and the loading skeleton all go — the events are fetched on the server and arrive in the first render.

```tsx
import { HomePageClient } from "@/components/layout/home-page-client";
import { getHomeContent } from "@/lib/home-actions";
import { getUpcomingEvents } from "@/lib/event-actions";

export default async function Home() {
  const [content, events] = await Promise.all([getHomeContent(), getUpcomingEvents()]);

  return (
    <HomePageClient
      content={content}
      events={events.slice(0, content.content.events.count).map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        date: e.date.toISOString(),
        location: e.location,
        description: e.description,
        image: e.imageUrl || "/images/placeholder.svg",
      }))}
    />
  );
}
```

- [ ] **Step 5: Drop the skeleton branch from the events band**

In `events-band-section.tsx`, remove the `isLoading` prop and the skeleton `<div>` grid it guarded. The component now renders `events.length > 0 ? <EventsShowcase /> : <empty state>`. Nothing passes `isLoading` any more.

- [ ] **Step 6: Verify the page renders as before**

Run: `npm run lint && npm run build`, then `npm run dev` and open `/`. Check in order:

1. Every section is present, in today's order.
2. Backgrounds read white, cream, white, blush, white down the page — identical to `git stash`-ing your changes and reloading.
3. The events band and the committee row each have a hairline rule above and below.
4. Events appear in the initial HTML: disable JavaScript, reload, and the event cards are still there.
5. `/about` is untouched — the committee row still sits seamlessly under the section above it.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(public)/page.tsx" src/components/layout/
git commit -m "Render the home page from a stored layout on the server"
```

---

### Task 7: Wire the hero content

**Files:**
- Modify: `src/components/layout/hero.tsx`, `src/components/layout/home-page-client.tsx`

**Interfaces:**
- Consumes: `HomeContentT["content"]["hero"]`, `splitOnAccent` (Task 3).
- Produces: `<Hero content={...} surface={...} />`. The renderer passes `tone` and `bordered` to every section; the hero simply does not declare them, which is harmless — its type and its black background are fixed.

- [ ] **Step 1: Pass content down from the renderer**

In `home-page-client.tsx`, add `content={content.content[id]}` to the `<Section />` spread so every section receives its own block:

```tsx
<Section
  key={id}
  content={content.content[id]}
  surface={surface}
  tone={tone}
  bordered={bordered}
  {...(id === "events" ? { events } : {})}
/>
```

- [ ] **Step 2: Accept the content in the hero**

In `hero.tsx`, take a `content` prop defaulted to the built-in hero defaults, so the component still renders standalone:

```tsx
import { DEFAULT_HOME_CONTENT, type HomeContentT } from "@/lib/home-schema";
import { withAccent } from "@/components/layout/with-accent";

export function Hero({
  content = DEFAULT_HOME_CONTENT.content.hero,
  surface = "bg-black",
}: {
  content?: HomeContentT["content"]["hero"];
  surface?: string;
}) {
```

- [ ] **Step 3: Replace the hardcoded strings**

Six replacements, leaving every class name and animation exactly as it is:

- `poster="/hero-poster.jpg"` → `poster={content.posterUrl}`
- `<source src="/hero.mp4" …>` → `<source src={content.videoUrl} …>`
- the eyebrow's `Kerala Samajam Augsburg` → `{content.badge}`
- the `<h1>` body → `{withAccent(content.headline, content.accentWord)}`
- the sub-copy paragraph → `{content.lead}`
- the two `<Link href>`/`<Button>` label pairs → `content.primaryCta.href` / `.label` and `content.secondaryCta.href` / `.label`

The headline's accent has its own gradient treatment in the hero (`bg-linear-to-br from-primary to-primary/70 bg-clip-text …`), which differs from `<Accent>`. Keep the hero's own span: rather than `withAccent`, use `splitOnAccent` directly here so the gradient survives.

```tsx
const { before, match, after } = splitOnAccent(content.headline, content.accentWord);
```

```tsx
{before}
{match && (
  <span className="bg-linear-to-br from-primary to-primary/70 bg-clip-text font-serif font-normal italic tracking-[-0.015em] text-transparent">
    {match}
  </span>
)}
{after}
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`, then open `/`. The hero must be pixel-identical: same video, same badge, same gradient "Kerala", same two buttons. Then temporarily edit `DEFAULT_HOME_CONTENT.content.hero.headline` to `"A home for Kerala in the heart of Munich"`, reload to confirm the text follows, and revert the edit.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/hero.tsx src/components/layout/home-page-client.tsx
git commit -m "Drive the hero from stored content"
```

---

### Task 8: Wire the "who we are" section

**Files:**
- Create: `src/lib/home-icons.ts`
- Modify: `src/components/layout/about-intro.tsx`

**Interfaces:**
- Consumes: `HOME_ICONS`, `HomeContentT["content"]["about"]`, `withAccent`.
- Produces: `HOME_ICON_MAP: Record<(typeof HOME_ICONS)[number], LucideIcon>`.

- [ ] **Step 1: Write the icon map**

Create `src/lib/home-icons.ts`, mirroring [about-icons.ts](../../../src/lib/about-icons.ts):

```ts
import {
  BookOpen,
  Flower2,
  GraduationCap,
  HeartHandshake,
  Languages,
  Music,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";

import type { HOME_ICONS } from "./home-schema";

/** Name → component for the pillar icons. Shared by the admin dropdown and
 *  the renderer so a stored string is never guessed at. */
export const HOME_ICON_MAP: Record<(typeof HOME_ICONS)[number], LucideIcon> = {
  Flower2,
  HeartHandshake,
  Languages,
  Music,
  GraduationCap,
  Users,
  Utensils,
  BookOpen,
};
```

- [ ] **Step 2: Accept content in the section**

In `about-intro.tsx`, delete the module-level `pillars` and `facts` arrays and take the content as a prop:

```tsx
export function AboutIntro({
  content = DEFAULT_HOME_CONTENT.content.about,
  surface = "bg-surface-1",
  bordered = false,
}: {
  content?: HomeContentT["content"]["about"];
  surface?: string;
  bordered?: boolean;
}) {
```

- [ ] **Step 3: Replace the hardcoded strings**

Working top to bottom through the component:

- `<Eyebrow>About us</Eyebrow>` → `{content.eyebrow}`
- the `<SectionTitle>` body → `{withAccent(content.title, content.accentWord)}`
- the `<SectionLead>` body → `{content.lead}`
- `facts.map(...)` → `content.facts.map(...)`; the `grid-cols-3` on the `<dl>` becomes `` className={cn("mt-10 grid max-w-lg border-y border-border", content.facts.length === 2 ? "grid-cols-2" : content.facts.length === 4 ? "grid-cols-4" : "grid-cols-3")} `` so two or four facts do not leave a hole
- the `/about` link's label → `{content.storyLink.label}`, its `href` → `content.storyLink.href`
- the tall figure's `src`/`alt` → `content.collage.primary.url` / `.alt`; the `<figcaption>` span → `{content.collage.primary.caption}`, wrapped in `{content.collage.primary.caption && ( … )}` so a blank caption renders no overlay
- the square figure's `src`/`alt` → `content.collage.secondary.url` / `.alt`
- the pull-quote paragraph → `{content.quote.text}`; the "Since 2012" span → `{content.quote.footnote}`, wrapped in a truthiness guard the same way
- `<Eyebrow>What we do</Eyebrow>` → `{content.pillarsEyebrow}`; the note beside it → `{content.pillarsNote}`
- `pillars.map((item, i) => …)` → `content.pillars.map((item, i) => …)`, and `<item.icon … />` becomes:

```tsx
{(() => {
  const Icon = HOME_ICON_MAP[item.icon];
  return <Icon strokeWidth={1.6} className="h-5 w-5" />;
})()}
```

Simpler and preferred: hoist it at the top of the `map` callback.

```tsx
{content.pillars.map((item, i) => {
  const Icon = HOME_ICON_MAP[item.icon];
  return (
    // …existing markup, with <item.icon …/> replaced by <Icon strokeWidth={1.6} className="h-5 w-5" />
  );
})}
```

The `String(i + 1).padStart(2, "0")` numbering stays derived from the index — it is never stored.

- [ ] **Step 4: Apply the surface props**

The outer `<section>` background becomes `cn("relative scroll-mt-20 overflow-hidden py-24 md:py-32", surface, bordered && "border-y border-border")`. Leave the two ambient blur divs and the `id="vision"` anchor alone.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build`, then open `/`. Compare against the previous commit: the three facts, the collage with its caption, the pull-quote with "Since 2012", and all six pillars with their icons and `01`–`06` numbering must be unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/lib/home-icons.ts src/components/layout/about-intro.tsx
git commit -m "Drive the who-we-are section from stored content"
```

---

### Task 9: Wire the events band

**Files:**
- Modify: `src/components/layout/events-band-section.tsx`

**Interfaces:**
- Consumes: `HomeContentT["content"]["events"]`, `withAccent`.
- Produces: nothing new.

- [ ] **Step 1: Accept content**

```tsx
export function EventsBandSection({
  content = DEFAULT_HOME_CONTENT.content.events,
  events,
  surface = "bg-surface-2",
  bordered = true,
}: {
  content?: HomeContentT["content"]["events"];
  events: EventCard[];
  surface?: string;
  bordered?: boolean;
}) {
```

- [ ] **Step 2: Replace the hardcoded strings**

- eyebrow → `{content.eyebrow}`; title → `{withAccent(content.title, content.accentWord)}`; lead → `{content.lead}`
- the outline button's label → `{content.cta.label}`, its `<Link href>` → `content.cta.href`
- the empty state's two paragraphs → `{content.empty.title}` and `{content.empty.body}`
- the outer `<section>` → `cn("relative overflow-hidden py-24 md:py-32", surface, bordered && "border-y border-border")`

`content.count` is applied by the server page when it slices the events (Task 6), so this component renders whatever it is handed.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`, then open `/`. The heading, lead and "Full Calendar" button are unchanged. To check the empty state without emptying the calendar, temporarily pass `events={[]}` from `home-page-client.tsx`, confirm the copy, then revert.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/events-band-section.tsx
git commit -m "Drive the events band from stored content"
```

---

### Task 10: Wire the gallery and committee sections

**Files:**
- Modify: `src/components/layout/gallery-strip.tsx`, `src/components/layout/leadership-row.tsx`

**Interfaces:**
- Consumes: `HomeContentT["content"]["gallery"]`, `HomeContentT["content"]["committee"]`, `withAccent`.
- Produces: nothing new.

Both are heading-only conversions. `LeadershipRow` needs care: the About page renders it too.

- [ ] **Step 1: Convert the gallery strip**

Take `content = DEFAULT_HOME_CONTENT.content.gallery` plus `surface`/`bordered` as in Task 9. Replace the eyebrow, the `Photo <Accent>Gallery</Accent>` title (via `withAccent`), the lead, and the "View all albums" link's label and `href`. Leave the album/photo counter, the mosaic and the fallback shots untouched — they come from `getGalleryHighlights()`.

- [ ] **Step 2: Convert the committee row**

`leadership-row.tsx` already has a props interface. Add `content` to it, defaulted, and — this is the part that matters — keep `limit` working for the About page:

```tsx
export function LeadershipRow({
  content = DEFAULT_HOME_CONTENT.content.committee,
  limit,
  showEmptyState = false,
  seamless = false,
  surface = "bg-surface-3",
  bordered = true,
  className,
}: LeadershipRowProps) {
  const effectiveLimit = limit ?? content.limit;
```

`limit` loses its `= 8` default and becomes optional. The About page passes `limit={0}` explicitly and keeps showing everyone; the home page passes nothing and gets `content.limit`. Use `effectiveLimit` in the existing `const shown = effectiveLimit > 0 ? members.slice(0, effectiveLimit) : members;`.

Replace the eyebrow, the `Our <Accent>Committee</Accent>` title and the lead from `content`. Leave the "Committee Not Listed Yet" empty state hardcoded — it is an admin-facing placeholder, not marketing copy, and the About page shows it too.

- [ ] **Step 3: Verify both pages**

Run: `npm run lint && npm run build`, then check `/` (gallery heading and committee heading unchanged, committee shows at most 8) **and** `/about` (committee section still shows every member, still seamless under the section above, heading unchanged). The About page is the regression risk in this task.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/gallery-strip.tsx src/components/layout/leadership-row.tsx
git commit -m "Drive the gallery and committee headings from stored content"
```

---

### Task 11: Wire the join steps

**Files:**
- Modify: `src/components/layout/join-steps.tsx`

- [ ] **Step 1: Accept content and delete the `steps` array**

Take `content = DEFAULT_HOME_CONTENT.content.join` plus `surface = "bg-surface-1"` and `bordered = false`. Delete the module-level `steps` const.

- [ ] **Step 2: Replace the hardcoded strings**

Eyebrow, title (via `withAccent`), lead, the "View All Plans" button label and `href`, and `steps.map(...)` → `content.steps.map(...)`. The `grid md:grid-cols-3` on the `<ol>` becomes `` cn("grid gap-px overflow-hidden rounded-3xl border border-border bg-border", content.steps.length === 1 ? "md:grid-cols-1" : content.steps.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3") `` so one or two steps do not stretch oddly; four or more wrap onto a second row of three, which is the intended behaviour. The `01`/`02`/`03` numbering stays derived from the index.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`, then open `/`. Three steps, same copy, same numbering, same hover.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/join-steps.tsx
git commit -m "Drive the join steps from stored content"
```

---

### Task 12: Wire the closing CTA band

**Files:**
- Modify: `src/components/layout/join-cta.tsx`

- [ ] **Step 1: Accept content**

Take `content = DEFAULT_HOME_CONTENT.content.cta`, `surface = "bg-surface-deep"`, `tone = "dark"` and `bordered = false`.

- [ ] **Step 2: Replace the hardcoded strings**

Eyebrow, title (via `withAccent`), lead, and both buttons' labels and `href`s. Thread `tone` into `<Eyebrow tone={tone}>`, `<SectionTitle tone={tone}>` and `<SectionLead tone={tone}>` rather than the hardcoded `tone="dark"` — the band is always dark today, but the prop is what keeps that true if the surface ever changes.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`, then open `/`. The dark band at the foot of the page is unchanged: glow, dot grid, white heading with the primary "KSA", two buttons.

- [ ] **Step 4: Reorder end-to-end, by hand**

This is the first point where the whole rendering path can be proven. In `DEFAULT_HOME_CONTENT.layout`, temporarily move `join` above `events` and set `gallery` to `visible: false`. Reload `/` and confirm:

1. The gallery section is gone.
2. No two neighbouring sections share a background.
3. Every heading is still legible — nothing white-on-white.

Revert the edit before committing.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/join-cta.tsx
git commit -m "Drive the closing CTA band from stored content"
```

---

### Task 13: Video upload support

**Files:**
- Modify: `src/components/admin/image-upload.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `<ImageUpload accept="video/*" … />` renders a `<video>` preview and accepts video files.

- [ ] **Step 1: Add the prop**

Add `accept = "image/*"` to `ImageUploadProps` and pass it to the `<input type="file" accept={accept} />` in place of the hardcoded `"image/*"`.

- [ ] **Step 2: Render the right preview element**

The preview must handle both an uploaded Cloudinary URL and a local `blob:` object URL for a file that has not finished uploading. Derive it from the prop, not from the URL:

```tsx
const isVideo = accept.startsWith("video");
```

Then in the preview branch, replace the single `<img>` with:

```tsx
{isVideo ? (
  <video
    src={preview}
    muted
    loop
    autoPlay
    playsInline
    className="h-full w-full object-cover"
  />
) : (
  <img src={preview} alt="Upload preview" className="h-full w-full object-cover" />
)}
```

- [ ] **Step 3: Update the two labels**

The hover button reads "Change image" and the empty state reads "Click to upload an image" / "PNG, JPG or WEBP, up to 10MB". Make all three follow `isVideo`: "Change video", "Click to upload a video", "MP4, MOV or WEBM, up to 100MB". The `aria-label="Remove image"` becomes `Remove video` too. The image limit text is wrong today (the server allows 8 MB, not 10) — fix it to "up to 8MB" while you are in there; the video figure of 100 MB comes from `MAX_VIDEO_BYTES` in [upload-validation.ts](../../../src/lib/upload-validation.ts).

- [ ] **Step 4: Verify nothing broke for images**

Run: `npm run lint && npm run build`, then open `/admin/about` and upload a hero image. It must behave exactly as before — preview, "Change image", remove. No admin screen passes `accept` yet, so every existing call site takes the image path.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/image-upload.tsx
git commit -m "Let the upload field take video as well as images"
```

---

### Task 14: Admin shell — permission, nav, page, layout list and hero fields

**Files:**
- Create: `src/components/admin/ui/field.tsx`, `src/components/admin/home/section-card.tsx`, `src/components/admin/home/hero-fields.tsx`, `src/components/admin/home/home-content-editor.tsx`, `src/app/admin/(dashboard)/home/page.tsx`
- Modify: `src/lib/permissions.ts`, `src/app/admin/(dashboard)/layout.tsx:88`, `src/components/admin/about-content-editor.tsx`, `tests/permissions.test.ts`

**Interfaces:**
- Consumes: `getHomeContent`/`saveHomeContent` (Task 4), `HOME_SECTION_META` (Task 2), `homeContentSchema`/`HomeContentT` (Task 1).
- Produces: `<Field label error>`, `<SectionCard>`, `<HeroFields control register errors setValue watch>`, and the pattern every later section editor follows.

- [ ] **Step 1: Add the permission and fix its test**

In `src/lib/permissions.ts`, beside `content.about.edit`:

```ts
"content.home.edit": { group: "Content", label: "Edit the Home page", mutates: true },
```

`tests/permissions.test.ts` asserts `toHaveLength(55)`. Bump it to `56`.

Run: `npm test -- permissions`
Expected: PASS.

- [ ] **Step 2: Add the nav item**

In `src/app/admin/(dashboard)/layout.tsx`, in the Community group directly above the "About Page" entry:

```tsx
{ href: "/admin/home", label: "Home Page", icon: Home, isActive: (p) => p.startsWith("/admin/home") },
```

Import `Home` from `lucide-react` alongside the other icons.

- [ ] **Step 3: Lift the `Field` helper**

Create `src/components/admin/ui/field.tsx` containing exactly the `Field` component currently defined at the top of `about-content-editor.tsx` (lines 20–36), with `"use client"` at the top and an `export`. Then delete the local copy from `about-content-editor.tsx` and import it instead. Run `npm run build` to confirm the About editor still compiles.

- [ ] **Step 4: Write the section card**

Create `src/components/admin/home/section-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, MoveDown, MoveUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cardSurface, panelHeader } from "@/components/admin/ui/surface";
import { cn } from "@/lib/utils";

/**
 * One collapsible section in the home page editor: label, a visibility
 * toggle, and move buttons. Collapsed by default so seven sections stay
 * scannable. Move buttons rather than drag handles — the About card editor
 * already uses them, they need no dependency, and they work from a keyboard.
 */
export function SectionCard({
  label,
  description,
  visible,
  onVisibleChange,
  onMoveUp,
  onMoveDown,
  movable,
  children,
}: {
  label: string;
  description: string;
  visible: boolean;
  onVisibleChange: (next: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  movable: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn(cardSurface, !visible && "opacity-60")}>
      <div className={panelHeader}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          />
          <span>
            <span className="block font-sans text-sm font-semibold text-foreground">{label}</span>
            <span className="block text-xs text-muted-foreground">{description}</span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <label className="mr-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => onVisibleChange(e.target.checked)}
              className="h-4 w-4 rounded border-muted"
            />
            Visible
          </label>

          {movable && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!onMoveUp}
                onClick={onMoveUp}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={`Move ${label} up`}
              >
                <MoveUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!onMoveDown}
                onClick={onMoveDown}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={`Move ${label} down`}
              >
                <MoveDown className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {open && <div className="space-y-5 p-5 sm:p-6">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Write the hero fields**

Create `src/components/admin/home/hero-fields.tsx`. Every later section editor copies this shape: it receives the parent form's `register`, `errors`, `watch` and `setValue`, and registers under a fixed `content.<id>.*` path.

```tsx
"use client";

import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import ImageUpload from "@/components/admin/image-upload";
import type { HomeContentT } from "@/lib/home-schema";

export function HeroFields({
  register,
  errors,
  watch,
  setValue,
}: {
  register: UseFormRegister<HomeContentT>;
  errors: FieldErrors<HomeContentT>;
  watch: UseFormWatch<HomeContentT>;
  setValue: UseFormSetValue<HomeContentT>;
}) {
  const e = errors.content?.hero;
  const videoUrl = watch("content.hero.videoUrl");
  const posterUrl = watch("content.hero.posterUrl");

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="space-y-5">
        <Field label="Badge" error={e?.badge?.message}>
          <Input {...register("content.hero.badge")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Headline" error={e?.headline?.message}>
          <Input {...register("content.hero.headline")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Highlighted word/phrase in headline" error={e?.accentWord?.message}>
          <Input {...register("content.hero.accentWord")} className="h-9 rounded-lg" />
          <p className="text-xs text-muted-foreground">
            Must match text within the headline above exactly. Leave blank for no highlight.
          </p>
        </Field>
        <Field label="Sub-copy" error={e?.lead?.message}>
          <Textarea {...register("content.hero.lead")} rows={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary button label" error={e?.primaryCta?.label?.message}>
            <Input {...register("content.hero.primaryCta.label")} className="h-9 rounded-lg" />
          </Field>
          <Field label="Primary button link" error={e?.primaryCta?.href?.message}>
            <Input {...register("content.hero.primaryCta.href")} className="h-9 rounded-lg" />
          </Field>
          <Field label="Second button label" error={e?.secondaryCta?.label?.message}>
            <Input {...register("content.hero.secondaryCta.label")} className="h-9 rounded-lg" />
          </Field>
          <Field label="Second button link" error={e?.secondaryCta?.href?.message}>
            <Input {...register("content.hero.secondaryCta.href")} className="h-9 rounded-lg" />
          </Field>
        </div>
      </div>

      <div className="space-y-5">
        <Field label="Background video" error={e?.videoUrl?.message}>
          <ImageUpload
            accept="video/*"
            onUploadComplete={(url) =>
              setValue("content.hero.videoUrl", url, { shouldValidate: true })
            }
            defaultValue={videoUrl}
            aspect="aspect-video"
          />
        </Field>
        <Field label="Poster image" error={e?.posterUrl?.message}>
          <ImageUpload
            onUploadComplete={(url) =>
              setValue("content.hero.posterUrl", url, { shouldValidate: true })
            }
            defaultValue={posterUrl}
            aspect="aspect-video"
          />
          <p className="text-xs text-muted-foreground">
            Shown while the video loads, and instead of it for visitors who prefer reduced motion.
          </p>
        </Field>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write the editor**

Create `src/components/admin/home/home-content-editor.tsx`. It owns the single `useForm`, the layout field array, and the save. Sections other than the hero render a placeholder for now — Tasks 15 and 16 fill them in.

```tsx
"use client";

import { useState } from "react";
import { useFieldArray, useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/home/section-card";
import { HeroFields } from "@/components/admin/home/hero-fields";
import { saveHomeContent } from "@/lib/home-actions";
import { homeContentSchema, type HomeContentT } from "@/lib/home-schema";
import { HOME_SECTION_META } from "@/lib/home-sections";

export function HomeContentEditor({ initialData }: { initialData: HomeContentT }) {
  const [isSaving, setIsSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HomeContentT>({
    resolver: zodResolver(homeContentSchema),
    defaultValues: initialData,
  });

  const { fields, move, update } = useFieldArray({ control, name: "layout" });

  // `fields` entries carry react-hook-form's own generated `id`, which
  // shadows our section id of the same name — reading `field.id` would hand
  // you a uuid and HOME_SECTION_META[uuid] is undefined. Take the values from
  // watch() and use `field.id` only as the React key, where a stable
  // generated id is exactly what you want across a move().
  const layout = watch("layout");

  const onSubmit: SubmitHandler<HomeContentT> = async (data) => {
    setIsSaving(true);
    try {
      await saveHomeContent(data);
      success("Home page updated.");
    } catch (err: any) {
      console.error("Failed to save home content:", err);
      toastError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // The hero is pinned to the top, so nothing may move above index 1.
  const firstMovable = 1;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <PageHeader
        title="Home Page"
        description="Edit the copy, images and order of the sections on the public home page."
      >
        <Button type="submit" disabled={isSaving} className="h-9 rounded-lg">
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save changes
        </Button>
      </PageHeader>

      {fields.map((field, index) => {
        const entry = layout[index];
        if (!entry) return null;
        const meta = HOME_SECTION_META[entry.id];

        return (
          <SectionCard
            key={field.id}
            label={meta.label}
            description={meta.description}
            movable={meta.movable}
            visible={entry.visible}
            onVisibleChange={(next) => update(index, { id: entry.id, visible: next })}
            onMoveUp={meta.movable && index > firstMovable ? () => move(index, index - 1) : undefined}
            onMoveDown={
              meta.movable && index < fields.length - 1 ? () => move(index, index + 1) : undefined
            }
          >
            {entry.id === "hero" ? (
              <HeroFields
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Fields for this section are added in the next task.
              </p>
            )}
          </SectionCard>
        );
      })}
    </form>
  );
}
```

Note `update()` rather than a `register`ed checkbox for visibility: `useFieldArray` owns those objects, and `update` is how you change one without desynchronising the array.

- [ ] **Step 7: Write the admin page**

Create `src/app/admin/(dashboard)/home/page.tsx`:

```tsx
import { requireAdminPage } from "@/lib/guards";
import { getHomeContent } from "@/lib/home-actions";
import { HomeContentEditor } from "@/components/admin/home/home-content-editor";

export default async function AdminHomePage() {
  await requireAdminPage();

  const content = await getHomeContent();

  return <HomeContentEditor initialData={content} />;
}
```

- [ ] **Step 8: Verify the round trip**

Run: `npm test && npm run lint && npm run build`, then `npm run dev` and sign in to `/admin/home`. Confirm:

1. Seven collapsed cards, in page order, "Home Page" highlighted in the sidebar.
2. The hero card has no move buttons; the other six do, and the topmost movable card's up button is disabled.
3. Expanding the hero shows its fields filled with today's copy.
4. Change the hero headline, Save, open `/` — the new headline is live.
5. Untick "Visible" on the committee card, Save, reload `/` — the section is gone and the backgrounds still alternate.
6. Move "How to join" above "Upcoming events", Save, reload `/` — the order changed and no two neighbours share a background.

- [ ] **Step 9: Commit**

```bash
git add src/lib/permissions.ts tests/permissions.test.ts "src/app/admin/(dashboard)/layout.tsx" "src/app/admin/(dashboard)/home/page.tsx" src/components/admin/ui/field.tsx src/components/admin/home/ src/components/admin/about-content-editor.tsx
git commit -m "Add the home page editor with section ordering and hero fields"
```

---

### Task 15: The "who we are" section editor

**Files:**
- Create: `src/components/admin/home/about-fields.tsx`
- Modify: `src/components/admin/home/home-content-editor.tsx`

**Interfaces:**
- Consumes: the props shape established by `HeroFields`, plus `control` for the nested arrays.
- Produces: `<AboutFields control register errors watch setValue />`.

This is the only section with nested field arrays, which is why it gets its own task.

- [ ] **Step 1: Write the component**

Create `src/components/admin/home/about-fields.tsx`. It takes `control` in addition to the props `HeroFields` takes, and runs two `useFieldArray` hooks against the parent form:

```tsx
const facts = useFieldArray({ control, name: "content.about.facts" });
const pillars = useFieldArray({ control, name: "content.about.pillars" });
```

Lay it out as four blocks, each a `<div className="space-y-5">` separated by `<hr className="border-black/[0.06] dark:border-white/[0.06]" />`:

1. **Heading** — `eyebrow`, `title`, `accentWord` (with the same "must match text within the title" hint as the hero), `lead`, and the story link's `label` and `href`.
2. **Facts** — one row per fact, an "Add fact" button disabled at 4, remove disabled at 2. The row markup, which the pillars and the join steps both reuse with different fields:

```tsx
<div className="flex items-center justify-between">
  <h3 className="font-sans text-sm font-semibold text-foreground">Facts</h3>
  <Button
    type="button"
    variant="outline"
    className="h-9 rounded-lg"
    disabled={facts.fields.length >= 4}
    onClick={() => facts.append({ value: "", label: "" })}
  >
    <Plus className="mr-2 h-4 w-4" />
    Add fact
  </Button>
</div>

{facts.fields.map((field, index) => (
  <div key={field.id} className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] md:items-start">
    <Field label="Value" error={errors.content?.about?.facts?.[index]?.value?.message}>
      <Input
        {...register(`content.about.facts.${index}.value` as const)}
        placeholder="e.g. 2012"
        className="h-9 rounded-lg"
      />
    </Field>
    <Field label="Label" error={errors.content?.about?.facts?.[index]?.label?.message}>
      <Input
        {...register(`content.about.facts.${index}.label` as const)}
        placeholder="e.g. Founded"
        className="h-9 rounded-lg"
      />
    </Field>
    <div className="flex gap-1 pt-6 md:justify-end">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={index === 0}
        onClick={() => facts.move(index, index - 1)}
        className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
        aria-label="Move up"
      >
        <MoveUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={index === facts.fields.length - 1}
        onClick={() => facts.move(index, index + 1)}
        className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
        aria-label="Move down"
      >
        <MoveDown className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={facts.fields.length <= 2}
        onClick={() => facts.remove(index)}
        className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        aria-label="Remove fact"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  </div>
))}
```

Here `field.id` **is** safe to use as the React key — these rows have no `id` of their own for react-hook-form to shadow, unlike the layout array in Task 14.
3. **Collage** — two `ImageUpload`s (`content.about.collage.primary.url` at `aspect-4/3`, `content.about.collage.secondary.url` at `aspect-square`), each with an alt-text `Input` beside it, the primary's optional `caption`, and the pull-quote's `text` (`Textarea`, 3 rows) and `footnote`.
4. **What we do** — `pillarsEyebrow`, `pillarsNote`, then `pillars.fields.map(...)` in the same four-column grid the About editor uses for its cards. Same row scaffolding as the facts above, with `md:grid-cols-[140px_1fr_1fr_auto]`, "Add pillar" disabled at 8, remove disabled at 1, `append({ icon: "Flower2", title: "", desc: "" })`, and these three fields:

```tsx
<Field label="Icon" error={errors.content?.about?.pillars?.[index]?.icon?.message}>
  <select
    {...register(`content.about.pillars.${index}.icon` as const)}
    className="h-9 w-full rounded-lg border border-muted/60 bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
  >
    {HOME_ICONS.map((icon) => (
      <option key={icon} value={icon}>
        {icon}
      </option>
    ))}
  </select>
</Field>
<Field label="Title" error={errors.content?.about?.pillars?.[index]?.title?.message}>
  <Input
    {...register(`content.about.pillars.${index}.title` as const)}
    placeholder="e.g. Malayalam Classes"
    className="h-9 rounded-lg"
  />
</Field>
<Field label="Description" error={errors.content?.about?.pillars?.[index]?.desc?.message}>
  <Textarea {...register(`content.about.pillars.${index}.desc` as const)} rows={3} />
</Field>
```

Field paths are `content.about.facts.${index}.value`, `content.about.pillars.${index}.icon`, and so on — always absolute, never relative to the layout position.

- [ ] **Step 2: Render it from the editor**

In `home-content-editor.tsx`, replace the placeholder for `about` with `<AboutFields control={control} register={register} errors={errors} watch={watch} setValue={setValue} />`.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`, then at `/admin/home`:

1. Expand "Who we are" — three facts, six pillars, both collage images with their alt text, the quote and its footnote all show today's values.
2. Reorder two pillars, Save, reload `/` — the order changed and the `01`–`06` numbering renumbered accordingly.
3. Delete a fact so two remain, Save, reload `/` — the spec row is a two-column grid, not a three-column one with a hole.
4. Try to remove the last pillar — the button is disabled.
5. Clear the collage caption, Save, reload `/` — the caption overlay is gone and the image is undamaged.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/home/
git commit -m "Add the who-we-are fields to the home page editor"
```

---

### Task 16: The remaining section editors

**Files:**
- Create: `src/components/admin/home/events-fields.tsx`, `gallery-fields.tsx`, `committee-fields.tsx`, `join-fields.tsx`, `cta-fields.tsx`
- Modify: `src/components/admin/home/home-content-editor.tsx`

**Interfaces:**
- Consumes: the same prop shape as `HeroFields`; `join-fields.tsx` also takes `control` for its steps array.
- Produces: one component per remaining section, wired into the editor.

Each is small. A shared heading block appears in all five — write it once:

- [ ] **Step 1: Write the shared heading fields**

Add `src/components/admin/home/heading-fields.tsx` exporting `<HeadingFields section register errors />` where `section` is one of `"events" | "gallery" | "committee" | "join" | "cta"`. It renders `eyebrow`, `title`, `accentWord` (with the match hint) and `lead`, registering at `content.${section}.eyebrow` and so on. Type it as:

```tsx
export function HeadingFields({
  section,
  register,
  errors,
}: {
  section: "events" | "gallery" | "committee" | "join" | "cta";
  register: UseFormRegister<HomeContentT>;
  errors: FieldErrors<HomeContentT>;
}) {
```

Inside, reach the errors with `const e = errors.content?.[section];`.

- [ ] **Step 2: Write the five section editors**

Each renders `<HeadingFields section="…" … />` plus its own extras:

- `events-fields.tsx` — `count` (`<Input type="number" {...register("content.events.count", { valueAsNumber: true })} min={1} max={8} />`; `valueAsNumber` is required or zod rejects the string), the CTA `label`/`href`, and the empty state's `title` and `body`.
- `gallery-fields.tsx` — the link's `label` and `href`.
- `committee-fields.tsx` — `limit`, same `valueAsNumber` treatment, min 1 max 24, with the hint "How many committee members to show on the home page."
- `join-fields.tsx` — the CTA `label`/`href`, plus a `useFieldArray` over `content.join.steps` with `title` and `desc` per row, move/remove buttons, "Add step" disabled at 6 and remove disabled at 1 — the same pattern as the pillars in Task 15.
- `cta-fields.tsx` — both buttons' `label` and `href`.

- [ ] **Step 3: Wire them into the editor**

Replace the remaining placeholder branch in `home-content-editor.tsx` with a lookup rather than a chain of ternaries:

```tsx
{entry.id === "hero" && <HeroFields register={register} errors={errors} watch={watch} setValue={setValue} />}
{entry.id === "about" && <AboutFields control={control} register={register} errors={errors} watch={watch} setValue={setValue} />}
{entry.id === "events" && <EventsFields register={register} errors={errors} />}
{entry.id === "gallery" && <GalleryFields register={register} errors={errors} />}
{entry.id === "committee" && <CommitteeFields register={register} errors={errors} />}
{entry.id === "join" && <JoinFields control={control} register={register} errors={errors} />}
{entry.id === "cta" && <CtaFields register={register} errors={errors} />}
```

`entry` is the watched layout value from Task 14, not the `useFieldArray` field — see the comment there for why.

- [ ] **Step 4: Verify every field round-trips**

Run: `npm test && npm run lint && npm run build`, then at `/admin/home` expand every card and confirm each field shows today's value. Then make one edit per section — a changed word in each — Save once, and reload `/` to confirm all seven landed. Set the events `count` to 2 and confirm exactly two event cards render.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/home/
git commit -m "Add the remaining section fields to the home page editor"
```

---

### Task 17: Final verification

**Files:** none — this task changes nothing.

- [ ] **Step 1: Full check**

Run: `npm test && npm run lint && npm run build`
Expected: all pass. Record the test count.

- [ ] **Step 2: Prove the day-one promise**

On a machine with no `HomeContent` row (or after deleting it: `npx prisma studio`, `HomeContent` collection, delete the `current` document), load `/` and compare against `git show <commit-before-this-branch>:src/app/\(public\)/page.tsx` rendered from a stashed checkout. Every heading, paragraph, button label, image and pillar must match. This is the one promise the tests cannot make.

- [ ] **Step 3: Walk the reorder matrix once more**

At `/admin/home`, hide two sections, move the CTA band to sit directly after the hero, Save, and load `/`. Confirm: no white-on-white type in the CTA band, no two neighbouring sections sharing a background, no doubled hairline rules.

- [ ] **Step 4: Confirm the About page never moved**

Load `/about`. Hero, story cards, and the committee row — which now shares four props with the home page — must be exactly as they were before this branch.

- [ ] **Step 5: Commit anything outstanding**

```bash
git status
```

Expected: clean. If not, the change belongs to whichever earlier task it came from — commit it with that task's message style.
