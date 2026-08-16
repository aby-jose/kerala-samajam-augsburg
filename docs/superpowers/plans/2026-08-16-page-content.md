# Editable Contact, Membership and Listing Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every heading, paragraph, FAQ answer and empty state on `/contact`, `/membership`, `/events` and `/gallery` editable from the admin portal.

**Architecture:** One `PageContent` model keyed by slug holds a JSON document per page. A registry maps each slug to its zod schema, its defaults and the paths to revalidate, so one cached read and one guarded save serve every page. Each page keeps a hand-written react-hook-form editor, modelled on `about-content-editor.tsx`.

**Tech Stack:** Next.js 15 App Router, Prisma + MongoDB, zod 4, react-hook-form 7, framer-motion 12, Tailwind 4, Vitest, Cloudinary.

**Spec:** [docs/superpowers/specs/2026-08-16-page-content-design.md](../specs/2026-08-16-page-content-design.md)

## Phase 1 is a different plan

This plan covers Phases 2–5 of the spec. **Phase 1 — finishing the home page editor — is Tasks 14–17 of [the home page plan](2026-08-16-home-page-content.md)** and is not restated here.

Do Phase 1 first. Two things in this plan depend on it:

- `src/components/admin/ui/field.tsx`, which Task 14 Step 3 lifts out of `about-content-editor.tsx`. Every editor below imports it.
- The rebase reconciliations in spec §9, including swapping `requireAdmin()` for `requirePermission("content.home.edit")`.

If you are executing this plan and `src/components/admin/ui/field.tsx` does not exist, stop — Phase 1 has not been done.

## Global Constraints

- **Never use `.default()` in these zod schemas.** It makes a schema's input and output types diverge, which react-hook-form's `zodResolver` rejects. Defaults are merged in by `getPageContent()`. Already documented in [about-schema.ts](../../../src/lib/about-schema.ts).
- **Vitest runs in a `node` environment and only collects `tests/**/*.test.ts`.** No JSX, and no module that transitively imports a React component or `@/lib/prisma` may be imported by a test. Testable logic lives in pure `src/lib/*.ts` modules.
- **Default copy must be transcribed character for character** from the component it replaces — em dashes (`—`), curly apostrophes, `e.V.` and all. JSX wraps strings across lines; join them into one string with single spaces. Every conversion task has an explicit diff step, because no test catches this.
- **Feature gates still win.** `/gallery` and `/membership` 404 when their module is off regardless of stored content. Do not remove the `requireFeature()` calls already in those pages.
- **`(public)/layout.tsx` is `force-dynamic`.** Saves appear on the next request; do not add `revalidate` exports to these pages.
- Commands: `npm test`, `npm run lint`, `npm run build`. Prisma: `npx prisma db push`, `npx prisma generate`.

---

### Task 1: Storage model, registry and actions

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/page-content/registry.ts`, `src/lib/page-content/actions.ts`
- Test: `tests/page-content.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PageSlug`, `PAGE_SLUGS`, `isPageSlug(value: unknown): value is PageSlug`, `mergePageContent(slug: PageSlug, stored: unknown): Record<string, unknown>`, `getPageContent(slug)`, `savePageContent(slug, data)`.

Task 1 ships the storage layer with a single placeholder slug registered so it is testable on its own. Tasks 3, 6 and 7 register the real schemas.

- [ ] **Step 1: Write the failing test**

Create `tests/page-content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPageSlug, mergePageContent, PAGE_SLUGS } from "@/lib/page-content/registry";

describe("page content registry", () => {
  it("recognises its own slugs and nothing else", () => {
    for (const slug of PAGE_SLUGS) expect(isPageSlug(slug)).toBe(true);

    expect(isPageSlug("nonsense")).toBe(false);
    expect(isPageSlug("")).toBe(false);
    expect(isPageSlug(undefined)).toBe(false);
    expect(isPageSlug(42)).toBe(false);
  });

  it("accepts the defaults of every registered page", async () => {
    const { PAGE_CONTENT } = await import("@/lib/page-content/registry");

    for (const slug of PAGE_SLUGS) {
      const { schema, defaults } = PAGE_CONTENT[slug];
      expect(() => schema.parse(defaults), slug).not.toThrow();
    }
  });

  it("gives every page at least one path to revalidate", async () => {
    const { PAGE_CONTENT } = await import("@/lib/page-content/registry");

    for (const slug of PAGE_SLUGS) {
      expect(PAGE_CONTENT[slug].revalidate.length, slug).toBeGreaterThan(0);
    }
  });
});

describe("mergePageContent", () => {
  const slug = PAGE_SLUGS[0];

  it("returns the defaults when nothing is stored", async () => {
    const { PAGE_CONTENT } = await import("@/lib/page-content/registry");

    expect(mergePageContent(slug, undefined)).toEqual(PAGE_CONTENT[slug].defaults);
    expect(mergePageContent(slug, null)).toEqual(PAGE_CONTENT[slug].defaults);
  });

  it("keeps a stored section and fills the rest from defaults", async () => {
    const { PAGE_CONTENT } = await import("@/lib/page-content/registry");
    const defaults = PAGE_CONTENT[slug].defaults as Record<string, Record<string, unknown>>;
    const [firstKey, secondKey] = Object.keys(defaults);

    const merged = mergePageContent(slug, {
      [firstKey]: { title: "Edited title" },
    }) as Record<string, Record<string, unknown>>;

    expect(merged[firstKey].title).toBe("Edited title");
    // Sibling fields inside the edited section survive.
    expect(merged[firstKey].lead).toBe(defaults[firstKey].lead);
    // Untouched sections come through whole.
    expect(merged[secondKey]).toEqual(defaults[secondKey]);
  });

  it("drops section keys it does not recognise", () => {
    const merged = mergePageContent(slug, { nonsense: { title: "x" } }) as Record<string, unknown>;

    expect(merged.nonsense).toBeUndefined();
  });

  it("produces something the schema still accepts", async () => {
    const { PAGE_CONTENT } = await import("@/lib/page-content/registry");
    const defaults = PAGE_CONTENT[slug].defaults as Record<string, unknown>;
    const [firstKey] = Object.keys(defaults);

    const merged = mergePageContent(slug, { [firstKey]: { title: "Edited title" } });

    expect(() => PAGE_CONTENT[slug].schema.parse(merged)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- page-content`
Expected: FAIL — `Failed to resolve import "@/lib/page-content/registry"`.

- [ ] **Step 3: Add the model**

In `prisma/schema.prisma`, directly below the `AboutContent` model:

```prisma
/// One editable document per public page, keyed by slug. The singleton
/// content models above (Config, AboutContent, HomeContent) each hold exactly
/// one document and key on "current"; this table holds several, so the slug
/// is the identity — see lib/page-content/registry.ts for what each means.
model PageContent {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  slug      String   @unique // contact | membership | listings
  value     Json
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 4: Push the schema and regenerate the client**

Run: `npx prisma db push && npx prisma generate`
Expected: "Your database is now in sync with your Prisma schema", then a generated client. `prisma.pageContent` now exists in types.

- [ ] **Step 5: Write the registry**

Create `src/lib/page-content/registry.ts`. It starts with `contact` registered against a minimal placeholder schema so Task 1 is testable alone; Task 3 replaces that entry with the real one.

```ts
import { z } from "zod";

/**
 * What each page slug means: the shape of its document, the copy to fall back
 * on, and the routes whose cache a save invalidates.
 *
 * Kept free of prisma and React imports so the tests can read it under
 * Vitest's node environment — the actions that use it live next door in
 * actions.ts.
 */

// Replaced by the real schema in Task 3. Structured as section -> fields from
// the start, because mergePageContent merges one level deep.
const placeholderSchema = z.object({
  hero: z.object({
    title: z.string().min(1).max(160),
    lead: z.string().min(1).max(500),
  }),
  form: z.object({
    title: z.string().min(1).max(160),
    lead: z.string().min(1).max(500),
  }),
});

export const PAGE_CONTENT = {
  contact: {
    label: "Contact",
    schema: placeholderSchema,
    defaults: {
      hero: { title: "Get in Touch", lead: "Placeholder — replaced in Task 3." },
      form: { title: "Send a Message", lead: "Placeholder — replaced in Task 3." },
    },
    revalidate: ["/contact"],
  },
} as const satisfies Record<string, PageEntry>;

interface PageEntry {
  label: string;
  schema: z.ZodType<Record<string, unknown>>;
  defaults: Record<string, unknown>;
  revalidate: readonly string[];
}

export type PageSlug = keyof typeof PAGE_CONTENT;

export const PAGE_SLUGS = Object.keys(PAGE_CONTENT) as PageSlug[];

export const isPageSlug = (value: unknown): value is PageSlug =>
  typeof value === "string" && (PAGE_SLUGS as string[]).includes(value);

/**
 * Spread each stored section over its defaults, so a document saved before a
 * field existed keeps rendering rather than failing validation. Unknown
 * section keys are dropped: a field removed from a schema must not survive in
 * storage and reappear if the name is ever reused.
 *
 * One level deep by design — sections are merged, the fields inside them are
 * replaced wholesale. An array of FAQ items is a field, so an admin who
 * deletes one gets a document with one fewer, not a merge against the default
 * list.
 */
export function mergePageContent(slug: PageSlug, stored: unknown): Record<string, unknown> {
  const defaults = PAGE_CONTENT[slug].defaults as Record<string, unknown>;
  const source = (stored ?? {}) as Record<string, Record<string, unknown>>;

  const merged: Record<string, unknown> = {};

  for (const key of Object.keys(defaults)) {
    merged[key] = {
      ...(defaults[key] as Record<string, unknown>),
      ...(source[key] ?? {}),
    };
  }

  return merged;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- page-content`
Expected: PASS, 8 tests.

- [ ] **Step 7: Write the actions**

Create `src/lib/page-content/actions.ts`:

```ts
"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";

import { prisma } from "../prisma";
import { requirePermission } from "../guards";
import { isPageSlug, mergePageContent, PAGE_CONTENT, type PageSlug } from "./registry";

/**
 * The live document for a page, or the built-in defaults if nothing has been
 * saved yet. Deduped per request like getAboutContent() — the public page and
 * the admin form can both call it without a duplicate round trip.
 *
 * A database error logs and returns the defaults rather than propagating.
 * Failing soft is right for copy: a config blip should not blank the contact
 * page. Do not copy the pattern to anything guarding data.
 */
export const getPageContent = cache(async (slug: PageSlug): Promise<Record<string, unknown>> => {
  try {
    const record = await prisma.pageContent.findUnique({ where: { slug } });
    if (!record || !record.value) return mergePageContent(slug, undefined);

    return mergePageContent(slug, record.value);
  } catch (error) {
    console.error(`Page content fetch error (${slug}):`, error);
    return mergePageContent(slug, undefined);
  }
});

export async function savePageContent(slug: string, data: unknown) {
  await requirePermission("content.pages.edit");

  // Checked after the permission, before anything is written: an unknown slug
  // is a bug in a caller, not a document to create. Silently upserting one
  // would leave a row nothing ever reads.
  if (!isPageSlug(slug)) throw new Error(`Unknown page: ${slug}`);

  const validated = PAGE_CONTENT[slug].schema.parse(data);

  try {
    await prisma.pageContent.upsert({
      where: { slug },
      update: { value: validated as any },
      create: { slug, value: validated as any },
    });

    for (const path of PAGE_CONTENT[slug].revalidate) revalidatePath(path);
    revalidatePath(`/admin/pages/${slug}`);

    return { success: true };
  } catch (error) {
    console.error(`Failed to save page content (${slug}):`, error);
    throw new Error(`Failed to save ${PAGE_CONTENT[slug].label} page content`);
  }
}
```

- [ ] **Step 8: Add the permission**

In `src/lib/permissions.ts`, beside `content.about.edit`:

```ts
"content.pages.edit": { group: "Content", label: "Edit site pages", mutates: true },
```

`tests/permissions.test.ts` asserts a total count with `expect(ALL_PERMISSIONS).toHaveLength(N)`. Read the current `N` rather than trusting this plan — Phase 1 adds `content.home.edit` first — and bump it by one.

- [ ] **Step 9: Register the action as permission-checked**

`tests/action-coverage.test.ts` asserts every exported server action is permission-checked. Run it and follow its failure message to register `savePageContent`:

Run: `npm test -- action-coverage`
Expected: PASS once registered.

- [ ] **Step 10: Verify and commit**

Run: `npm test && npm run lint && npm run build`
Expected: all pass. Nothing consumes the actions yet.

```bash
git add prisma/schema.prisma src/lib/page-content/ src/lib/permissions.ts tests/page-content.test.ts tests/permissions.test.ts tests/action-coverage.test.ts
git commit -m "Add PageContent storage with a slug registry and guarded save"
```

---

### Task 2: Shared heading fields and the inline link parser

**Files:**
- Create: `src/lib/page-content/section.ts`, `src/components/layout/inline-links.tsx`
- Modify: `tests/page-content.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `sectionHeadingFields` (a plain object spread into zod schemas), `parseInlineLinks(text: string): InlineNode[]` where `InlineNode = { text: string; href?: string }`, and `<InlineLinks text={...} />`.

The contact FAQ answers currently contain JSX — `<FaqLink href="/events">event page</FaqLink>` sits mid-sentence. Storing them as plain strings would silently drop those links. A three-line markdown subset keeps them.

- [ ] **Step 1: Write the failing test**

Append to `tests/page-content.test.ts`:

```ts
import { parseInlineLinks } from "@/lib/page-content/section";

describe("parseInlineLinks", () => {
  it("returns one plain node when there is no link", () => {
    expect(parseInlineLinks("Just a sentence.")).toEqual([{ text: "Just a sentence." }]);
  });

  it("splits a sentence around a link", () => {
    expect(
      parseInlineLinks("Apply through the [membership page](/membership). The committee confirms it.")
    ).toEqual([
      { text: "Apply through the " },
      { text: "membership page", href: "/membership" },
      { text: ". The committee confirms it." },
    ]);
  });

  it("handles a link at the very start and the very end", () => {
    expect(parseInlineLinks("[Events](/events) are open.")).toEqual([
      { text: "Events", href: "/events" },
      { text: " are open." },
    ]);

    expect(parseInlineLinks("See the [events page](/events)")).toEqual([
      { text: "See the " },
      { text: "events page", href: "/events" },
    ]);
  });

  it("handles several links in one answer", () => {
    const nodes = parseInlineLinks("[One](/a) then [two](/b).");

    expect(nodes.filter((n) => n.href)).toEqual([
      { text: "One", href: "/a" },
      { text: "two", href: "/b" },
    ]);
  });

  it("leaves malformed syntax as literal text rather than dropping it", () => {
    // An admin typing a bracket must never make their sentence vanish.
    expect(parseInlineLinks("A [bracket without a link.")).toEqual([
      { text: "A [bracket without a link." },
    ]);
    expect(parseInlineLinks("Empty () parens.")).toEqual([{ text: "Empty () parens." }]);
  });

  it("never returns an empty node", () => {
    for (const node of parseInlineLinks("[Events](/events)")) {
      expect(node.text.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- page-content`
Expected: FAIL — `Failed to resolve import "@/lib/page-content/section"`.

- [ ] **Step 3: Write the shared fields and the parser**

Create `src/lib/page-content/section.ts`:

```ts
import { z } from "zod";

/**
 * Eyebrow, title, accent word and lead — the block every section on every one
 * of these pages repeats. Spread into a section schema rather than nested, so
 * a field path stays `hero.title` instead of `hero.heading.title` and the
 * editors stay flat.
 *
 * Mirrors `headingFields` in home-schema.ts. Not shared with it on purpose:
 * the home document is its own model with its own migration history, and
 * coupling the two would mean a limit change on one page silently retuning
 * validation on the other.
 */
export const sectionHeadingFields = {
  eyebrow: z.string().min(1, "Required").max(60),
  title: z.string().min(1, "Required").max(160),
  // Must appear inside `title` verbatim; rendered in the serif italic accent.
  // Plain text when blank or not found — see lib/accent.ts.
  accentWord: z.string().max(60).optional().or(z.literal("")),
  lead: z.string().min(1, "Required").max(500),
};

export interface InlineNode {
  text: string;
  href?: string;
}

/** `[label](/href)` — the only markup admin-entered prose supports. */
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Split a sentence into plain runs and link runs.
 *
 * The contact FAQ answers had their links written as JSX, so moving the copy
 * into the database would have flattened them into plain text. This is the
 * smallest syntax that keeps them: no bold, no lists, nothing that lets an
 * administrator break the page's typography.
 *
 * Anything that does not match is returned as literal text. A stray bracket
 * must render as a stray bracket — never swallow a sentence because someone
 * typed one.
 */
export function parseInlineLinks(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(LINK)) {
    const start = match.index ?? 0;

    if (start > cursor) nodes.push({ text: text.slice(cursor, start) });
    nodes.push({ text: match[1], href: match[2] });

    cursor = start + match[0].length;
  }

  if (cursor < text.length) nodes.push({ text: text.slice(cursor) });

  return nodes.length ? nodes : [{ text }];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- page-content`
Expected: PASS.

- [ ] **Step 5: Write the rendering half**

Create `src/components/layout/inline-links.tsx`:

```tsx
import Link from "next/link";

import { parseInlineLinks } from "@/lib/page-content/section";
import { cn } from "@/lib/utils";

/**
 * Renders admin-entered prose, turning `[label](/href)` into a link. The
 * pure splitter lives in lib/page-content/section.ts so it can be unit tested
 * under Vitest's node environment.
 */
export function InlineLinks({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {parseInlineLinks(text).map((node, i) =>
        node.href ? (
          <Link
            key={i}
            href={node.href}
            className={cn(
              "font-medium text-primary underline-offset-4 transition-colors hover:underline",
              className
            )}
          >
            {node.text}
          </Link>
        ) : (
          <span key={i}>{node.text}</span>
        )
      )}
    </>
  );
}
```

- [ ] **Step 6: Match it to the existing FaqLink**

Open `src/app/(public)/contact/page.tsx` and find the `FaqLink` component. Copy its exact class names into `InlineLinks` above, replacing the ones written here, so the links render identically once Task 4 swaps them over.

- [ ] **Step 7: Verify and commit**

Run: `npm test && npm run lint && npm run build`

```bash
git add src/lib/page-content/section.ts src/components/layout/inline-links.tsx tests/page-content.test.ts
git commit -m "Add shared section fields and an inline link syntax for stored prose"
```

---

### Task 3: Contact schema and defaults

**Files:**
- Create: `src/lib/page-content/contact.ts`
- Modify: `src/lib/page-content/registry.ts`, `tests/page-content.test.ts`

**Interfaces:**
- Consumes: `sectionHeadingFields` (Task 2).
- Produces: `contactContentSchema`, `ContactContentT`, `DEFAULT_CONTACT`.

- [ ] **Step 1: Write the failing test**

Append to `tests/page-content.test.ts`:

```ts
import { contactContentSchema, DEFAULT_CONTACT } from "@/lib/page-content/contact";

describe("contact content", () => {
  it("accepts its own defaults", () => {
    expect(() => contactContentSchema.parse(DEFAULT_CONTACT)).not.toThrow();
  });

  it("ships the four questions the page answers today", () => {
    expect(DEFAULT_CONTACT.faq.items).toHaveLength(4);
  });

  it("rejects an empty title", () => {
    expect(() =>
      contactContentSchema.parse({
        ...DEFAULT_CONTACT,
        hero: { ...DEFAULT_CONTACT.hero, title: "" },
      })
    ).toThrow();
  });

  it("requires at least one question", () => {
    expect(() =>
      contactContentSchema.parse({
        ...DEFAULT_CONTACT,
        faq: { ...DEFAULT_CONTACT.faq, items: [] },
      })
    ).toThrow();
  });

  it("keeps every accent word findable in its title", () => {
    // A word that is not in the title renders plain, which reads as a bug.
    for (const [name, section] of Object.entries(DEFAULT_CONTACT)) {
      const { title, accentWord } = section as { title?: string; accentWord?: string };
      if (!title || !accentWord) continue;

      expect(title, name).toContain(accentWord);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- page-content`
Expected: FAIL — `Failed to resolve import "@/lib/page-content/contact"`.

- [ ] **Step 3: Write the schema**

Create `src/lib/page-content/contact.ts`. Copy defaults **verbatim** from `src/app/(public)/contact/page.tsx`; the FAQ answers gain `[label](/href)` where they had `<FaqLink>`.

```ts
import { z } from "zod";

import { sectionHeadingFields } from "./section";

export const contactContentSchema = z.object({
  hero: z.object({
    eyebrow: sectionHeadingFields.eyebrow,
    title: sectionHeadingFields.title,
    accentWord: sectionHeadingFields.accentWord,
    lead: sectionHeadingFields.lead,
  }),
  form: z.object({ ...sectionHeadingFields }),
  faq: z.object({
    ...sectionHeadingFields,
    items: z
      .array(
        z.object({
          question: z.string().min(1, "Required").max(160),
          // Supports [label](/href) — see lib/page-content/section.ts.
          answer: z.string().min(1, "Required").max(600),
        })
      )
      .min(1, "At least one question is required")
      .max(12),
  }),
  visit: z.object({ ...sectionHeadingFields }),
});

export type ContactContentT = z.infer<typeof contactContentSchema>;

/** The copy that lived in app/(public)/contact/page.tsx before this editor. */
export const DEFAULT_CONTACT: ContactContentT = {
  hero: {
    eyebrow: "Contact",
    title: "Get in Touch",
    accentWord: "Touch",
    lead: "Questions about membership, an event, or moving to Augsburg? Write to us and a member of the committee will get back to you.",
  },
  form: {
    eyebrow: "Write to us",
    title: "Send a Message",
    accentWord: "Message",
    lead: "Everything here lands with the same handful of volunteers. Tell us what you need and we will point you at the right person.",
  },
  faq: {
    eyebrow: "Questions",
    title: "Asked Often",
    accentWord: "Often",
    lead: "The four we answer most weeks. If yours is not here, the form above is the place for it.",
    items: [
      {
        question: "Do I have to be a member to come?",
        answer:
          "Most of what we do is open to everyone. A few evenings are members-only, and the [event page](/events) always says so before you register.",
      },
      {
        question: "How do I join?",
        answer:
          "Apply through the [membership page](/membership). The committee confirms it, and the year's invitations start arriving from there.",
      },
      {
        question: "Can I bring the children?",
        answer:
          "Always. There is usually a corner of the hall that belongs entirely to them by the end of the evening.",
      },
      {
        question: "We have just moved to Augsburg.",
        answer:
          "Then write anyway. Anmeldung, flats, schools, insurance — someone here has done it recently and will walk you through it.",
      },
    ],
  },
  visit: {
    eyebrow: "Or simply turn up",
    title: "Come Say Hello In Person",
    accentWord: "In Person",
    lead: "Most of our events are open to everyone, and the easiest introduction is to walk in and eat with us. No message required.",
  },
};
```

- [ ] **Step 4: Diff the defaults against the page**

Open the page beside your defaults and confirm every string matches character for character — em dashes, the curly apostrophe in `year's`, and the exact wording of both answers you just transcribed. No test catches this.

- [ ] **Step 5: Register it**

In `src/lib/page-content/registry.ts`, delete `placeholderSchema` entirely and replace the `contact` entry:

```ts
import { contactContentSchema, DEFAULT_CONTACT } from "./contact";

export const PAGE_CONTENT = {
  contact: {
    label: "Contact",
    schema: contactContentSchema,
    defaults: DEFAULT_CONTACT,
    revalidate: ["/contact"],
  },
} as const satisfies Record<string, PageEntry>;
```

- [ ] **Step 6: Run the tests and commit**

Run: `npm test -- page-content`
Expected: PASS — including the registry tests from Task 1, now running against the real schema.

```bash
git add src/lib/page-content/contact.ts src/lib/page-content/registry.ts tests/page-content.test.ts
git commit -m "Add contact page schema with today's copy as defaults"
```

---

### Task 4: Render the contact page from stored content

**Files:**
- Create: `src/app/(public)/contact/contact-client.tsx`
- Modify: `src/app/(public)/contact/page.tsx` (rewritten)

**Interfaces:**
- Consumes: `getPageContent` (Task 1), `ContactContentT` (Task 3), `withAccent` and `InlineLinks`.
- Produces: `<ContactClient content={...} />`.

`withAccent` comes from `src/components/layout/with-accent.tsx`, landed by Phase 1.

- [ ] **Step 1: Move the page into a client component**

Create `src/app/(public)/contact/contact-client.tsx`. Move the entire current contents of `page.tsx` into it verbatim, keeping `"use client"`, and rename the default export:

```tsx
export function ContactClient({ content }: { content: ContactContentT }) {
```

Add the imports it now needs:

```tsx
import type { ContactContentT } from "@/lib/page-content/contact";
import { withAccent } from "@/components/layout/with-accent";
import { InlineLinks } from "@/components/layout/inline-links";
```

Do not replace any copy yet. This step is a pure move.

- [ ] **Step 2: Make the route a server component**

Replace `src/app/(public)/contact/page.tsx` entirely:

```tsx
import { getPageContent } from "@/lib/page-content/actions";
import type { ContactContentT } from "@/lib/page-content/contact";
import { ContactClient } from "./contact-client";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const content = (await getPageContent("contact")) as ContactContentT;

  return <ContactClient content={content} />;
}
```

- [ ] **Step 3: Verify the move changed nothing**

Run: `npm run lint && npm run build`, then `npm run dev` and open `/contact`. Every section must look exactly as before — the page is still rendering its hardcoded strings, and `content` is unused so far.

- [ ] **Step 4: Replace the hardcoded copy**

In `contact-client.tsx`, four substitutions. The `PageHeader` in the hero takes `title` as a node, so pass `withAccent`:

```tsx
<PageHeader
  eyebrow={content.hero.eyebrow}
  title={withAccent(content.hero.title, content.hero.accentWord)}
  lead={content.hero.lead}
/>
```

For the form, FAQ and visit sections, replace each `<Eyebrow>`, `<SectionTitle>` and `<SectionLead>` body the same way — for example the form section:

```tsx
<Eyebrow>{content.form.eyebrow}</Eyebrow>
<SectionTitle className="mt-6">
  {withAccent(content.form.title, content.form.accentWord)}
</SectionTitle>
```

```tsx
<SectionLead className="max-w-sm md:text-right">{content.form.lead}</SectionLead>
```

Keep `tone="dark"` on the visit section's headings exactly as it is.

- [ ] **Step 5: Replace the FAQ array**

Delete the inline array of four `{ q, a }` objects and map the stored items instead, rendering each answer through `InlineLinks`:

```tsx
{content.faq.items.map((item) => (
  // …the same cell markup as before, with:
  //   {item.question}   where {faq.q} was
  //   <InlineLinks text={item.answer} />   where {faq.a} was
))}
```

The `FaqLink` component is now unused — delete it, and drop any imports it alone needed. Run `npm run lint` to find them rather than guessing.

- [ ] **Step 6: Verify the page is unchanged**

Run: `npm run lint && npm run build`, then open `/contact`. Check: the hero accent still renders "Get in **Touch**" in serif italic; all four questions appear in the same order; the links inside answers one and two still work and still look like links.

Then temporarily edit `DEFAULT_CONTACT.hero.lead`, reload to confirm the page follows, and revert.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(public)/contact/"
git commit -m "Render the contact page from stored content"
```

---

### Task 5: The contact editor and the admin route

**Files:**
- Create: `src/components/admin/pages/contact-content-editor.tsx`, `src/app/admin/(dashboard)/pages/[slug]/page.tsx`
- Modify: `src/app/admin/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `getPageContent`/`savePageContent` (Task 1), `contactContentSchema`/`ContactContentT` (Task 3), `Field` from `src/components/admin/ui/field.tsx` (Phase 1).
- Produces: `<ContactContentEditor initialData={...} />`, and the pattern Tasks 6 and 7 follow.

- [ ] **Step 1: Write the editor**

Create `src/components/admin/pages/contact-content-editor.tsx`, modelled on `src/components/admin/about-content-editor.tsx` — read that file first and follow its structure.

```tsx
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import { cardSurface, panelHeader } from "@/components/admin/ui/surface";
import { useToast } from "@/components/ui/toast";
import { savePageContent } from "@/lib/page-content/actions";
import { contactContentSchema, type ContactContentT } from "@/lib/page-content/contact";

/** Eyebrow, title, accent and lead — the four fields every section shares. */
function HeadingFields({
  register,
  errors,
  section,
}: {
  register: any;
  errors: any;
  section: "hero" | "form" | "faq" | "visit";
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Eyebrow" error={errors?.[section]?.eyebrow?.message}>
        <Input {...register(`${section}.eyebrow`)} />
      </Field>
      <Field label="Title" error={errors?.[section]?.title?.message}>
        <Input {...register(`${section}.title`)} />
      </Field>
      <Field
        label="Accent word"
        error={errors?.[section]?.accentWord?.message}
        hint="Must appear in the title. Rendered in serif italic."
      >
        <Input {...register(`${section}.accentWord`)} />
      </Field>
      <Field label="Lead" error={errors?.[section]?.lead?.message} className="md:col-span-2">
        <Textarea rows={3} {...register(`${section}.lead`)} />
      </Field>
    </div>
  );
}

export function ContactContentEditor({ initialData }: { initialData: ContactContentT }) {
  const { success, error: toastError } = useToast();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ContactContentT>({
    resolver: zodResolver(contactContentSchema),
    defaultValues: initialData,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "faq.items" });

  const onSubmit = async (data: ContactContentT) => {
    try {
      await savePageContent("contact", data);
      success("Contact page saved");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {(["hero", "form", "faq", "visit"] as const).map((section) => (
        <section key={section} className={cardSurface}>
          <header className={panelHeader}>
            <h2 className="font-sans text-sm font-semibold capitalize text-foreground">
              {section === "visit" ? "Come say hello" : section}
            </h2>
          </header>
          <div className="space-y-4 p-5">
            <HeadingFields register={register} errors={errors} section={section} />

            {section === "faq" && (
              <div className="space-y-4 border-t border-border pt-4">
                {fields.map((field, i) => (
                  <div key={field.id} className="space-y-3 rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Field
                        label={`Question ${i + 1}`}
                        error={errors.faq?.items?.[i]?.question?.message}
                        className="flex-1"
                      >
                        <Input {...register(`faq.items.${i}.question`)} />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => remove(i)}
                        disabled={fields.length === 1}
                        aria-label={`Remove question ${i + 1}`}
                        className="mt-7 shrink-0 text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Field
                      label="Answer"
                      error={errors.faq?.items?.[i]?.answer?.message}
                      hint="Link with [label](/path) — for example [membership page](/membership)."
                    >
                      <Textarea rows={3} {...register(`faq.items.${i}.answer`)} />
                    </Field>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ question: "", answer: "" })}
                  className="h-9 rounded-lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add question
                </Button>
              </div>
            )}
          </div>
        </section>
      ))}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !isDirty} className="h-10 rounded-lg px-6">
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
```

If `Field` does not accept a `hint` prop, add one — it is a one-line change in `src/components/admin/ui/field.tsx` and Tasks 6 and 7 rely on it too.

- [ ] **Step 2: Write the admin route**

Create `src/app/admin/(dashboard)/pages/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { requirePermissionPage } from "@/lib/guards";
import { PageHeader } from "@/components/admin/ui/page-header";
import { getPageContent } from "@/lib/page-content/actions";
import { isPageSlug, PAGE_CONTENT } from "@/lib/page-content/registry";
import { ContactContentEditor } from "@/components/admin/pages/contact-content-editor";
import type { ContactContentT } from "@/lib/page-content/contact";

export default async function AdminPageContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requirePermissionPage("content.pages.edit");

  const { slug } = await params;
  if (!isPageSlug(slug)) notFound();

  const content = await getPageContent(slug);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${PAGE_CONTENT[slug].label} page`}
        description="Edit the wording shown to visitors. Changes appear immediately."
      />
      {slug === "contact" && (
        <ContactContentEditor initialData={content as ContactContentT} />
      )}
    </div>
  );
}
```

Tasks 6 and 7 add their branches to the same conditional.

- [ ] **Step 3: Add the navigation entries**

In `src/app/admin/(dashboard)/layout.tsx`, in the same group as the "About Page" entry, below it:

```tsx
{ href: "/admin/pages/contact", label: "Contact Page", icon: Mail, isActive: (p) => p === "/admin/pages/contact" },
```

Import `Mail` from `lucide-react` alongside the other icons. The nav is already permission-filtered, so confirm this entry is declared with the same `permission: "content.pages.edit"` key the neighbouring entries use — read how "About Page" declares `content.about.edit` and copy that shape exactly.

- [ ] **Step 4: Verify end to end**

Run: `npm test && npm run lint && npm run build`, then `npm run dev`:

1. Sign in as a Super Admin. "Contact Page" appears in the nav.
2. Open it. Every field is populated with today's copy.
3. Change the hero lead, save, and confirm the toast.
4. Open `/contact` — the new lead is there.
5. Add a fifth question with an answer containing `[events](/events)`, save, reload `/contact`, and confirm it renders as a working link.
6. Empty the hero title and try to save. The form refuses with "Required" and nothing is written.
7. Sign in as a role without `content.pages.edit`. The nav entry is gone and `/admin/pages/contact` redirects to no-access.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/pages/ "src/app/admin/(dashboard)/pages/" "src/app/admin/(dashboard)/layout.tsx" src/components/admin/ui/field.tsx
git commit -m "Add the contact page editor"
```

---

### Task 6: Membership page

**Files:**
- Create: `src/lib/page-content/membership.ts`, `src/components/admin/pages/membership-content-editor.tsx`
- Modify: `src/lib/page-content/registry.ts`, `src/app/(public)/membership/page.tsx`, `src/components/public/membership-client.tsx`, `src/app/admin/(dashboard)/pages/[slug]/page.tsx`, `src/app/admin/(dashboard)/layout.tsx`, `tests/page-content.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–3, and the editor shape from Task 5.
- Produces: `membershipContentSchema`, `MembershipContentT`, `DEFAULT_MEMBERSHIP`, `<MembershipContentEditor initialData={...} />`.

`/membership` already has a server route component wrapping `MembershipClient`, so no extraction is needed. The plans themselves stay `MembershipPlan` rows — only the surrounding copy moves.

- [ ] **Step 1: Write the failing test**

Append to `tests/page-content.test.ts`:

```ts
import { DEFAULT_MEMBERSHIP, membershipContentSchema } from "@/lib/page-content/membership";

describe("membership content", () => {
  it("accepts its own defaults", () => {
    expect(() => membershipContentSchema.parse(DEFAULT_MEMBERSHIP)).not.toThrow();
  });

  it("keeps all six benefits, not the four the page displays", () => {
    // membership-client.tsx renders benefits.slice(0, 4), but the array has
    // always held six. Storing only the visible four would silently delete
    // two on the first save.
    expect(DEFAULT_MEMBERSHIP.benefits.items).toHaveLength(6);
  });

  it("requires at least one benefit", () => {
    expect(() =>
      membershipContentSchema.parse({
        ...DEFAULT_MEMBERSHIP,
        benefits: { ...DEFAULT_MEMBERSHIP.benefits, items: [] },
      })
    ).toThrow();
  });

  it("only accepts icons from the curated set", () => {
    expect(() =>
      membershipContentSchema.parse({
        ...DEFAULT_MEMBERSHIP,
        benefits: {
          ...DEFAULT_MEMBERSHIP.benefits,
          items: [{ icon: "NotAnIcon", title: "x", description: "y" }],
        },
      })
    ).toThrow();
  });

  it("keeps every accent word findable in its title", () => {
    for (const [name, section] of Object.entries(DEFAULT_MEMBERSHIP)) {
      const { title, accentWord } = section as { title?: string; accentWord?: string };
      if (!title || !accentWord) continue;

      expect(title, name).toContain(accentWord);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- page-content`
Expected: FAIL — `Failed to resolve import "@/lib/page-content/membership"`.

- [ ] **Step 3: Write the schema**

Create `src/lib/page-content/membership.ts`. The defaults below are transcribed from the module-level `benefits` array and the headings in `src/components/public/membership-client.tsx`.

```ts
import { z } from "zod";

import { sectionHeadingFields } from "./section";

/**
 * Curated icon set for the benefit cards, same contract as ABOUT_ICONS: a
 * named tuple so the admin form offers a dropdown and the renderer never has
 * to guess whether a stored string is a real icon.
 *
 * The first six are the ones membership-client.tsx uses today; Users and
 * Ticket are there so an admin adding a benefit has something to pick.
 */
export const MEMBERSHIP_ICONS = [
  "Globe",
  "HeartHandshake",
  "Sparkles",
  "GraduationCap",
  "Calendar",
  "Vote",
  "Users",
  "Ticket",
] as const;

export const membershipContentSchema = z.object({
  hero: z.object({
    eyebrow: sectionHeadingFields.eyebrow,
    title: sectionHeadingFields.title,
    accentWord: sectionHeadingFields.accentWord,
    lead: sectionHeadingFields.lead,
  }),
  plans: z.object({ ...sectionHeadingFields }),
  benefits: z.object({
    ...sectionHeadingFields,
    imageUrl: z.string().min(1, "An image is required"),
    imageAlt: z.string().min(1, "Alt text is required").max(160),
    items: z
      .array(
        z.object({
          icon: z.enum(MEMBERSHIP_ICONS),
          title: z.string().min(1, "Required").max(80),
          description: z.string().min(1, "Required").max(300),
        })
      )
      .min(1, "At least one benefit is required")
      .max(8),
  }),
});

export type MembershipContentT = z.infer<typeof membershipContentSchema>;

/** The copy that lived in components/public/membership-client.tsx. */
export const DEFAULT_MEMBERSHIP: MembershipContentT = {
  hero: {
    eyebrow: "Membership",
    title: "Become a Member",
    accentWord: "Member",
    lead: "One fee for the year. It pays for the halls, the sound system and the rice — and it keeps the festivals, the classes and the stage running.",
  },
  plans: {
    eyebrow: "Plans",
    title: "Pick the one that fits",
    accentWord: "fits",
    lead: "A student on their own, a single member, or the whole family under one fee. Everything a tier covers is listed on it — no small print underneath.",
  },
  benefits: {
    eyebrow: "Benefits",
    title: "What Membership Gives You",
    accentWord: "Gives You",
    lead: "Members get the invitations first, a say in how the Verein is run, and a vote at the general meeting. Beyond that, it is the simplest way to keep all of this going.",
    imageUrl: "/images/gallery/community_picnic.png",
    imageAlt: "KSA members at a community gathering in Augsburg",
    items: [
      {
        icon: "Globe",
        title: "Cultural Connection",
        description:
          "Stay deeply connected to Kerala's rich traditions through celebrations like Onam, Vishu, and Christmas.",
      },
      {
        icon: "HeartHandshake",
        title: "Community Network",
        description:
          "Build meaningful relationships with over 200+ Malayali families living in the Augsburg region.",
      },
      {
        icon: "Sparkles",
        title: "Support System",
        description:
          "Access a collective knowledge base for navigating life in Germany, from integration to professional growth.",
      },
      {
        icon: "GraduationCap",
        title: "Youth Development",
        description:
          "Provide your children with a platform to learn their heritage and develop leadership skills.",
      },
      {
        icon: "Calendar",
        title: "Event Access",
        description:
          "Get exclusive entry or discounted rates for KSA's year-round cultural workshops and gatherings.",
      },
      {
        icon: "Vote",
        title: "Citizen Voice",
        description:
          "Have your say in the organization's future through voting and participating in the General Body.",
      },
    ],
  },
};
```

- [ ] **Step 4: Write the icon map**

Create `src/lib/page-content/membership-icons.ts`, mirroring `src/lib/about-icons.ts`:

```ts
import { /* the same icons, imported from lucide-react */ type LucideIcon } from "lucide-react";

import type { MEMBERSHIP_ICONS } from "./membership";

/** Name → component for the benefit icons. Shared by the admin dropdown and
 *  the renderer so a stored string is never guessed at. */
export const MEMBERSHIP_ICON_MAP: Record<(typeof MEMBERSHIP_ICONS)[number], LucideIcon> = {
  // one entry per name in MEMBERSHIP_ICONS
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- page-content`
Expected: PASS.

- [ ] **Step 6: Register it**

In `src/lib/page-content/registry.ts`, add below `contact`:

```ts
  membership: {
    label: "Membership",
    schema: membershipContentSchema,
    defaults: DEFAULT_MEMBERSHIP,
    revalidate: ["/membership"],
  },
```

- [ ] **Step 7: Thread the content through the page**

In `src/app/(public)/membership/page.tsx`, keep the `requireFeature("enableMembership")` call exactly where it is and add the content read:

```tsx
export default async function MembershipPage() {
  await requireFeature("enableMembership");

  const [plans, content] = await Promise.all([
    getActiveMembershipPlans(),
    getPageContent("membership") as Promise<MembershipContentT>,
  ]);

  return <MembershipClient plans={plans} content={content} />;
}
```

In `membership-client.tsx`: accept `content: MembershipContentT`, delete the module-level `benefits` array, and replace the hero `PageHeader`, the plans heading block and the benefits heading block the same way Task 4 did for contact. Render each benefit's icon through `MEMBERSHIP_ICON_MAP[benefit.icon]`, and keep the `.slice(0, 4)` so the layout is unchanged.

- [ ] **Step 8: Add the editor and its route branch**

Create `src/components/admin/pages/membership-content-editor.tsx` following Task 5's editor exactly, with these differences: sections are `hero`, `plans`, `benefits`; the field array is `benefits.items` with an icon `<select>` over `MEMBERSHIP_ICONS`, a title `Input` and a description `Textarea`; plus `imageUrl` and `imageAlt` fields on the benefits section.

For the image field, reuse the uploader pattern in `src/components/admin/image-upload.tsx`.

Then in `src/app/admin/(dashboard)/pages/[slug]/page.tsx` add:

```tsx
{slug === "membership" && (
  <MembershipContentEditor initialData={content as MembershipContentT} />
)}
```

And a nav entry beside the contact one:

```tsx
{ href: "/admin/pages/membership", label: "Membership Page", icon: Users, isActive: (p) => p === "/admin/pages/membership" },
```

- [ ] **Step 9: Diff, verify and commit**

Diff the defaults against `membership-client.tsx` character for character. Then run `npm test && npm run lint && npm run build`, open `/membership`, and confirm the hero, the plans heading and all four benefit cards are identical to before — same icons, same order. Save an edit from the admin screen and confirm it appears.

```bash
git add src/lib/page-content/ src/components/admin/pages/ "src/app/(public)/membership/page.tsx" src/components/public/membership-client.tsx "src/app/admin/(dashboard)/" tests/page-content.test.ts
git commit -m "Render the membership page from stored content"
```

---

### Task 7: Events and gallery chrome

**Files:**
- Create: `src/lib/page-content/listings.ts`, `src/app/(public)/events/events-client.tsx`, `src/components/admin/pages/listings-content-editor.tsx`
- Modify: `src/lib/page-content/registry.ts`, `src/app/(public)/events/page.tsx`, `src/app/(public)/gallery/page.tsx`, `src/app/(public)/gallery/gallery-landing-client.tsx`, `src/app/admin/(dashboard)/pages/[slug]/page.tsx`, `src/app/admin/(dashboard)/layout.tsx`, `tests/page-content.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: `listingsContentSchema`, `ListingsContentT`, `DEFAULT_LISTINGS`, `<ListingsContentEditor initialData={...} />`.

One document covers both pages: neither has enough copy to justify its own model or admin screen.

- [ ] **Step 1: Write the failing test**

Append to `tests/page-content.test.ts`:

```ts
import { DEFAULT_LISTINGS, listingsContentSchema } from "@/lib/page-content/listings";

describe("listings content", () => {
  it("accepts its own defaults", () => {
    expect(() => listingsContentSchema.parse(DEFAULT_LISTINGS)).not.toThrow();
  });

  it("covers both pages", () => {
    expect(Object.keys(DEFAULT_LISTINGS).sort()).toEqual([
      "eventsCalendar",
      "eventsHero",
      "eventsMembersBand",
      "galleryAlbums",
      "galleryContribute",
      "galleryHero",
    ]);
  });

  it("rejects an empty heading anywhere", () => {
    expect(() =>
      listingsContentSchema.parse({
        ...DEFAULT_LISTINGS,
        galleryHero: { ...DEFAULT_LISTINGS.galleryHero, title: "" },
      })
    ).toThrow();
  });

  it("keeps every accent word findable in its title", () => {
    for (const [name, section] of Object.entries(DEFAULT_LISTINGS)) {
      const { title, accentWord } = section as { title?: string; accentWord?: string };
      if (!title || !accentWord) continue;

      expect(title, name).toContain(accentWord);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- page-content`
Expected: FAIL — `Failed to resolve import "@/lib/page-content/listings"`.

- [ ] **Step 3: Write the schema**

Create `src/lib/page-content/listings.ts`. The events hero and gallery hero have no eyebrow-less variant, so all six sections share the full heading block.

```ts
import { z } from "zod";

import { sectionHeadingFields } from "./section";

const section = z.object({ ...sectionHeadingFields });

export const listingsContentSchema = z.object({
  eventsHero: section,
  eventsCalendar: section,
  eventsMembersBand: section,
  galleryHero: section,
  galleryAlbums: z.object({
    eyebrow: sectionHeadingFields.eyebrow,
    title: sectionHeadingFields.title,
    accentWord: sectionHeadingFields.accentWord,
    // The albums grid has no lead today; keep the field optional so adding one
    // later is an edit rather than a migration.
    lead: z.string().max(500).optional().or(z.literal("")),
  }),
  galleryContribute: section,
});

export type ListingsContentT = z.infer<typeof listingsContentSchema>;

/** Copy from app/(public)/events/page.tsx and gallery/gallery-landing-client.tsx. */
export const DEFAULT_LISTINGS: ListingsContentT = {
  eventsHero: {
    eyebrow: "Events",
    title: "Upcoming Events",
    accentWord: "Events",
    lead: "Festivals, workshops and gatherings still to come. Most are open to everyone — bring a friend, and bring an appetite.",
  },
  eventsCalendar: {
    eyebrow: "Calendar",
    title: "Also on the Calendar",
    accentWord: "Calendar",
    lead: "Everything else already scheduled, in date order. Registration opens on each event's own page.",
  },
  eventsMembersBand: {
    eyebrow: "Members first",
    title: "Hear About Dates Before Anyone Else",
    accentWord: "Before",
    lead: "New dates usually go up a few weeks ahead, and members get the invitation first. Join, or just ask us what is being planned.",
  },
  galleryHero: {
    eyebrow: "Gallery",
    title: "Photo Gallery",
    accentWord: "Gallery",
    lead: "Every sadhya, every stage and every picnic since 2012, sorted by album. Search by face to find the photos you are in.",
  },
  galleryAlbums: {
    eyebrow: "Albums",
    title: "Browse the Archive",
    accentWord: "Archive",
    lead: "",
  },
  galleryContribute: {
    eyebrow: "Contribute",
    title: "Share Your Photos",
    accentWord: "Photos",
    lead: "Took pictures at one of our events? Send them in and they will join the album, credited to you, once a moderator has had a look.",
  },
};
```

- [ ] **Step 4: Diff the defaults against both pages**

Open `events/page.tsx` and `gallery/gallery-landing-client.tsx` beside the defaults. Confirm every string matches character for character — the em dash in the events hero lead, and the curly apostrophe in `event's own page`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- page-content`
Expected: PASS.

- [ ] **Step 6: Register it**

In `src/lib/page-content/registry.ts`:

```ts
  listings: {
    label: "Events & Gallery",
    schema: listingsContentSchema,
    defaults: DEFAULT_LISTINGS,
    revalidate: ["/events", "/gallery"],
  },
```

- [ ] **Step 7: Extract the events client and thread both pages**

`src/app/(public)/events/page.tsx` is `"use client"` today. Move its contents verbatim into `src/app/(public)/events/events-client.tsx` as `export function EventsClient({ content }: { content: ListingsContentT })`, then replace the route file:

```tsx
import { getPageContent } from "@/lib/page-content/actions";
import type { ListingsContentT } from "@/lib/page-content/listings";
import { EventsClient } from "./events-client";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const content = (await getPageContent("listings")) as ListingsContentT;

  return <EventsClient content={content} />;
}
```

Build and open `/events` to confirm the move changed nothing, **then** replace the three heading blocks using `withAccent`, exactly as Task 4 did.

For gallery, `page.tsx` is already a server component. Keep `requireFeature("enableGallery")` where it is, add the content read alongside the album query, and pass `content` into `GalleryLandingClient`. Replace its three heading blocks the same way. `galleryAlbums.lead` is empty by default — render it only when non-empty, so the layout is unchanged:

```tsx
{content.galleryAlbums.lead && (
  <SectionLead className="max-w-sm md:text-right">{content.galleryAlbums.lead}</SectionLead>
)}
```

- [ ] **Step 8: Add the editor and its route branch**

Create `src/components/admin/pages/listings-content-editor.tsx` following Task 5's editor, with six heading sections and no field arrays. Group them under two headings — "Events page" and "Gallery page" — so the screen reads as the two pages it edits.

Add the route branch and the nav entry:

```tsx
{slug === "listings" && (
  <ListingsContentEditor initialData={content as ListingsContentT} />
)}
```

```tsx
{ href: "/admin/pages/listings", label: "Events & Gallery", icon: LayoutGrid, isActive: (p) => p === "/admin/pages/listings" },
```

- [ ] **Step 9: Verify and commit**

Run `npm test && npm run lint && npm run build`, then open `/events` and `/gallery` and confirm every heading is identical to before. Save an edit to the gallery hero and confirm both that it appears and that `/events` is unaffected.

Then turn the gallery module off in Settings → Modules and confirm `/gallery` still 404s — the content document must not have reopened it.

```bash
git add src/lib/page-content/ src/components/admin/pages/ "src/app/(public)/events/" "src/app/(public)/gallery/" "src/app/admin/(dashboard)/" tests/page-content.test.ts
git commit -m "Render the events and gallery chrome from stored content"
```

---

### Task 8: Final verification

**Files:** none — this task only reads and runs.

- [ ] **Step 1: Full suite**

Run: `npm test && npm run lint && npm run build`
Expected: all pass. Note the build output — `/contact`, `/events`, `/gallery` and `/membership` must all be `ƒ` (dynamic). Any `○` means a content read got baked in at build time and edits will not appear.

- [ ] **Step 2: Round-trip every page**

For each of contact, membership, listings: open its admin screen, change one heading, save, and confirm the public page shows it. Then change it back.

- [ ] **Step 3: Confirm the defaults still hold for a fresh install**

In a mongo shell or Prisma Studio, delete the three `PageContent` rows. Reload all four public pages: every one must render its original copy from the defaults, with no errors in the server log.

- [ ] **Step 4: Confirm the permission gate**

As a role without `content.pages.edit`: no "Pages" nav entries, and `/admin/pages/contact` redirects to no-access. Then call `savePageContent` from the browser console as that role and confirm it throws rather than writing.

- [ ] **Step 5: Confirm the feature gates still win**

Turn off Modules → Gallery and Membership. `/gallery` and `/membership` must 404 even though their content documents exist.

- [ ] **Step 6: Grant the permissions**

On the roles screen, grant `content.pages.edit` (and `content.home.edit` from Phase 1) to the roles that should hold them. Neither is granted automatically, and a missing permission looks exactly like a broken page.
