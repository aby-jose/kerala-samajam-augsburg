# Email Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all 44 transactional email templates onto the new home-page-matched shell, with one consistent voice and a test suite that keeps them there.

**Architecture:** The design system (`tokens.ts`, `blocks.ts`, `shell.ts`) is already written and visually approved. This plan adds a discriminated union so both shells render side by side, converts the 44 templates one file at a time behind that bridge, then removes the bridge and the old shell. A fixture registry drives both the test suite and the preview gallery, so every conversion is visible and verified the moment it lands.

**Tech Stack:** TypeScript, Vitest (node environment, `tests/**/*.test.ts`), tsx for scripts, Prisma/MongoDB for site config.

**Spec:** [docs/superpowers/specs/2026-08-16-email-design-system-design.md](../specs/2026-08-16-email-design-system-design.md)

## Global Constraints

These apply to every task. Every conversion implicitly requires all of them.

**Imports.** Converted templates import from `../blocks` and `../shell`, never from `../components` or `../layout`:

```ts
import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { /* blocks */ } from "../blocks";
```

**Block mapping.** Mechanical, applied everywhere:

| Old | New |
|---|---|
| `dataCard(t, { title, rows, footnote })` | section `{ label: title, blocks: [facts(t, rows), footnote && paragraph(t, footnote, { small: true, muted: true })] }` |
| `amountCard(t, { caption, amount, sub, tone })` | `amount(t, { caption, amount, sub })` — **`tone` is dropped** |
| `codeBlock(t, code)` | `code(t, code)` |
| `eventCard(t, e)` | section `{ label: e.title, blocks: [eventFacts(t, e)] }` |
| `notice(t, { title, body, tone })` | `notice(t, { title, body })` — **`tone` is dropped** |
| `action: button(t, label, href)` | `close: { button: { label, href } }` |
| `note: note(t, "…")` | `close: { note: "…" }` — a raw string; the shell wraps it |
| `paragraph`, `quote`, `bulletList`, `steps`, `strong`, `link`, `statusPill`, `stack`, `esc` | same names, imported from `../blocks` |

**Removed from every template.** The `tone` field on the document. `Tone` no longer exists; urgency is carried by the eyebrow wording alone.

**Required on every template.** `sections` (may be `[]`) and `accentWord`. `accentWord` MUST appear in `title` verbatim — the test suite asserts it.

**Copy rules** (spec §7):

- **Subject** — what happened and to what. Sentence case, no `Your …` padding. Under 55 characters where content allows.
- **Preview** — continues the subject; never repeats it.
- **Eyebrow** — one to three words, the category.
- **Title** — three to seven words, containing exactly one accent word: the word carrying the news, never a filler.
- **Lead** — one or two sentences. Name the recipient, state the fact.
- **Note** — what to do if this is wrong, and how to reach a person.

**Structural limit.** `MAX_SECTIONS = 2`. Never more than two section panels.

**Never invent facts.** A rewrite restates what the template already claims. If current copy asserts something unverifiable from the code, keep the existing wording and note it in the commit message rather than replacing it with an invention.

**Verification after every conversion task:**

```bash
npx tsc --noEmit
npm test
npm run email:preview
```

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/email/tokens.ts` | Palette, spacing, brand derivation. **Already written.** |
| `src/lib/email/blocks.ts` | Block vocabulary. **Already written.** |
| `src/lib/email/shell.ts` | `Message`, `renderMessage`, surface rotation, `MAX_SECTIONS`. **Already written**, needs `sections` made required (Task 1). |
| `src/lib/email/send.ts` | `TemplateOutput` union + dispatch during migration; `Message` alone after Task 9. |
| `src/lib/email/layout.ts` | Old shell. Deleted in Task 9. |
| `src/lib/email/components.ts` | Old blocks. Deleted in Task 9. |
| `src/lib/email/templates/*.ts` | 44 templates across 8 files. |
| `scripts/email-fixtures.ts` | Sample args for all 44 + a fake context. Drives both the tests and the gallery. |
| `scripts/email-preview.ts` | Renders every fixture to `.email-preview/`. |
| `tests/email.test.ts` | Invariants over every template. |

---

### Task 0: Land the missing action row

`action()` is defined in `layout.ts` but never called from `renderEmail`, so at
`HEAD` every email ships with no button and no closing note. The fix exists
uncommitted in the working tree.

This goes first and alone. `renderEmail` stays live for every unconverted
template through Tasks 1–8, so leaving this until the end means every email sent
during the migration is still buttonless. It is also a one-line change worth
isolating in history rather than burying inside a redesign.

**Files:**
- Modify: `src/lib/email/layout.ts:314`

- [ ] **Step 1: Confirm the line is present in the working tree**

Run: `git diff src/lib/email/layout.ts`
Expected: exactly one added line, `${action(t, doc)}`, between `${body(t, doc)}`
and `${footer(t, ctx)}`. If the diff is empty, add it.

- [ ] **Step 2: Prove it changes the output**

Run:
```bash
git stash push src/lib/email/layout.ts
npm run email:preview && grep -c "View event details" .email-preview/events-ticket.html
git stash pop
npm run email:preview && grep -c "View event details" .email-preview/events-ticket.html
```
Expected: `0` before, non-zero after. (If the preview has already moved to the
new shell by the time you run this, use any template still on `renderEmail`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/layout.ts
git commit -m "Render the action row, which renderEmail never called"
```

---

### Task 1: The dual-render bridge

Both shells must render side by side while 44 templates convert one file at a time. `Message.sections` becomes required so it can serve as the discriminator — an `EmailDocument` never has it.

**Files:**
- Modify: `src/lib/email/shell.ts`
- Modify: `src/lib/email/send.ts`
- Modify: `src/lib/email/index.ts`
- Test: `tests/email-bridge.test.ts`

**Interfaces:**
- Consumes: `renderMessage(ctx, m)` and `Message` from `shell.ts`; `renderEmail(ctx, doc)` and `EmailDocument` from `layout.ts`.
- Produces: `TemplateOutput = EmailDocument | Message`; `renderFor(ctx, doc): string`. Every later task returns `Message` values that satisfy `TemplateOutput`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/email-bridge.test.ts
import { describe, expect, it } from "vitest";
import { renderFor } from "../src/lib/email/send";
import type { EmailContext } from "../src/lib/email/layout";

const ctx: EmailContext = {
  siteName: "Kerala Samajam Augsburg",
  contactEmail: "info@example.org",
  branding: { primaryColor: "#e11d48" },
  legal: {
    entityName: "Kerala Samajam Augsburg e.V.", legalForm: "e.V.",
    street: "Maximilianstraße 12", postalCode: "86150", city: "Augsburg",
    country: "Deutschland", registerCourt: "Amtsgericht Augsburg",
    registerNumber: "VR 1234", vatId: "", boardMembers: [],
    responsiblePerson: "", responsiblePersonAddress: "", dpoName: "",
    dpoEmail: "", supervisoryAuthority: "", hostingProvider: "",
    accountHolder: "Kerala Samajam Augsburg e.V.",
  } as EmailContext["legal"],
};

describe("renderFor", () => {
  it("routes a Message to the new shell", () => {
    const html = renderFor(ctx, {
      subject: "s", previewText: "p", eyebrow: "e",
      title: "Payment received", accentWord: "received",
      sections: [],
    });
    // The dot-grid backdrop exists only in the new shell.
    expect(html).toContain("data:image/svg+xml");
    expect(html).toContain("color-scheme\" content=\"light\"");
  });

  it("routes an EmailDocument to the old shell", () => {
    const html = renderFor(ctx, {
      subject: "s", previewText: "p", eyebrow: "e", title: "Old",
    });
    expect(html).not.toContain("data:image/svg+xml");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/email-bridge.test.ts`
Expected: FAIL — `renderFor` is not exported from `send.ts`.

- [ ] **Step 3: Make `sections` required**

In `src/lib/email/shell.ts`, change the `Message` interface:

```ts
  /**
   * The body, as ordered panels.
   *
   * Required, and the discriminator that tells `renderFor` which shell a
   * template speaks to — an `EmailDocument` never carries it. A message with
   * no body passes `[]`.
   */
  sections: MessageSection[];
```

And simplify the call in `renderMessage`, which no longer needs the fallback:

```ts
  const sections = m.sections.filter((s) => s.blocks.some((b) => !!b));
```

- [ ] **Step 4: Add the union and the dispatcher**

In `src/lib/email/send.ts`, replace the `TemplateOutput` alias:

```ts
import type { Message } from "./shell";
import { renderMessage } from "./shell";

/**
 * What a template returns.
 *
 * A union only while the 44 templates migrate from `EmailDocument` to
 * `Message`. Task 9 collapses it back to `Message` alone and deletes the old
 * shell; until then both render side by side and nothing is half-converted at
 * runtime.
 */
export type TemplateOutput = EmailDocument | Message;

const isMessage = (doc: TemplateOutput): doc is Message =>
  Array.isArray((doc as Message).sections);

/** Render whichever shell this template speaks to. */
export function renderFor(ctx: EmailContext, doc: TemplateOutput): string {
  return isMessage(doc) ? renderMessage(ctx, doc) : renderEmail(ctx, doc);
}
```

Then change the one render call inside `sendMail` from `renderEmail(ctx, built)` to `renderFor(ctx, built)`.

- [ ] **Step 5: Export it**

In `src/lib/email/index.ts`, add to the existing export line:

```ts
export { sendMail, sendMailBatch, getEmailContext, buildFrom, renderFor } from "./send";
export { renderMessage } from "./shell";
export type { Message, MessageContext, MessageSection, MessageClose } from "./shell";
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/email-bridge.test.ts && npx tsc --noEmit`
Expected: PASS, and a clean typecheck. `scripts/email-preview.ts` must still run — it builds `Message` values that already carry `sections`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/email/shell.ts src/lib/email/send.ts src/lib/email/index.ts tests/email-bridge.test.ts
git commit -m "Render both email shells behind one dispatcher"
```

---

### Task 2: Fixtures and the invariant suite

One registry of sample arguments drives both the test suite and the preview gallery, so a template that converts becomes visible and verified in the same step. It lives in `scripts/` rather than `src/` because it is development data and must not ship.

**Files:**
- Create: `scripts/email-fixtures.ts`
- Modify: `scripts/email-preview.ts`
- Create: `tests/email.test.ts`

**Interfaces:**
- Consumes: `templates` from `src/lib/email/index.ts`; `renderFor` from Task 1.
- Produces: `FIXTURES: Fixture[]` where `Fixture = { id, group, name, build(ctx): TemplateOutput }`, and `previewContext(): Promise<{ ctx, source }>`. Every later task adds entries here.

- [ ] **Step 1: Write the fixture registry**

```ts
// scripts/email-fixtures.ts
/**
 * Sample arguments for every template.
 *
 * One registry, two consumers: `email-preview.ts` renders it to disk and
 * `tests/email.test.ts` asserts invariants over it. A template with no
 * fixture is caught by the coverage test, so this file cannot silently fall
 * behind the way an eight-file module fell behind a seven-file survey.
 *
 * Development data — it lives in `scripts/` so it is never bundled.
 */
import { defaultConfig, type SiteConfig } from "../src/lib/config-schema";
import { templates } from "../src/lib/email";
import type { TemplateOutput } from "../src/lib/email/send";
import type { MessageContext } from "../src/lib/email/shell";

export interface Fixture {
  id: string;
  group: string;
  name: string;
  build: (ctx: MessageContext) => TemplateOutput;
}

export const EVENT = {
  title: "Onam Celebration 2026",
  slug: "onam-2026",
  date: new Date("2026-09-12T17:00:00Z"),
  startTime: "17:00",
  endTime: "22:30",
  location: "Zeughaus Augsburg",
  address: "Zeugplatz 4, 86150 Augsburg",
};

export const BANK = {
  accountHolder: "Kerala Samajam Augsburg e.V.",
  bankName: "Stadtsparkasse Augsburg",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "AUGSDE77XXX",
};

export const FIXTURES: Fixture[] = [
  // Populated one template file at a time by Tasks 3–10.
];

/** The real site config, falling back to defaults without a database. */
export async function previewContext(): Promise<{ ctx: MessageContext; source: string }> {
  let config: SiteConfig = defaultConfig;
  let source = "defaults";
  try {
    const { prisma } = await import("../src/lib/prisma");
    const record = await prisma.config.findUnique({ where: { key: "current" } });
    await prisma.$disconnect();
    if (record?.value) {
      const stored = record.value as Partial<SiteConfig>;
      config = {
        ...defaultConfig, ...stored,
        branding: { ...defaultConfig.branding, ...stored.branding },
        legal: { ...defaultConfig.legal, ...stored.legal },
      };
      source = "database";
    } else {
      source = "defaults (nothing saved)";
    }
  } catch (error) {
    source = `defaults (${error instanceof Error ? error.message.split("\n")[0] : String(error)})`;
  }

  return {
    ctx: {
      siteName: config.siteName,
      contactEmail: config.contactEmail,
      branding: {
        logoUrl: config.branding.logoUrl,
        siteName: config.siteName,
        primaryColor: process.env.PREVIEW_BRAND || config.branding.primaryColor,
      },
      legal: config.legal,
    },
    source,
  };
}

/** Every exported template, as `group/name` keys — used by the coverage test. */
export function allTemplateKeys(): string[] {
  return Object.entries(templates).flatMap(([group, mod]) =>
    Object.keys(mod as Record<string, unknown>).map((name) => `${group}/${name}`)
  );
}
```

- [ ] **Step 2: Write the invariant suite**

```ts
// tests/email.test.ts
import { describe, expect, it } from "vitest";
import { FIXTURES, allTemplateKeys, previewContext } from "../scripts/email-fixtures";
import { renderFor } from "../src/lib/email/send";
import { buildTheme } from "../src/lib/email/tokens";
import type { Message } from "../src/lib/email/shell";
import { MAX_SECTIONS } from "../src/lib/email/shell";

const { ctx } = await previewContext();
const t = buildTheme(ctx.branding);
const isMessage = (d: unknown): d is Message => Array.isArray((d as Message).sections);

/** Neutrals and dark-band values, which are not derived from the brand. */
const NEUTRALS = new Set([
  "#1c1a19", "#55504c", "#78716c", "#eae7e4", "#f4f2f0", "#ffffff", "#faf8f7",
  "#0f0f0f", "#9f9f9f", "#6f6f6f", "#262626", "#333333", "#1d1d1d",
]);

describe("every template", () => {
  it("has a fixture", () => {
    const covered = new Set(FIXTURES.map((f) => `${f.group}/${f.name}`));
    expect(allTemplateKeys().filter((k) => !covered.has(k))).toEqual([]);
  });

  for (const f of FIXTURES) {
    describe(`${f.group}/${f.name}`, () => {
      const doc = f.build(ctx);
      const html = renderFor(ctx, doc);

      it("renders", () => {
        expect(html).toContain("<html");
        expect(doc.subject.trim()).not.toBe("");
        expect(doc.previewText.trim()).not.toBe("");
        expect(doc.eyebrow.trim()).not.toBe("");
        expect(doc.title.trim()).not.toBe("");
      });

      it("uses only derived or neutral colours", () => {
        const derived = new Set([
          t.primary, t.primaryDeep, t.primaryTint, t.primaryEdge,
          t.bandA, t.bandB, t.onPrimary, "#a8a09a",
        ].map((c) => c.toLowerCase()));
        const stray = [...html.matchAll(/#[0-9a-fA-F]{6}/g)]
          .map((m) => m[0].toLowerCase())
          .filter((c) => !derived.has(c) && !NEUTRALS.has(c));
        expect([...new Set(stray)]).toEqual([]);
      });

      if (isMessage(doc)) {
        it("has an accent word that occurs in the title", () => {
          if (doc.accentWord) expect(doc.title).toContain(doc.accentWord);
        });

        it(`has at most ${MAX_SECTIONS} sections`, () => {
          expect(doc.sections.length).toBeLessThanOrEqual(MAX_SECTIONS);
        });

        it("declares light-only and ships no dark-mode rule", () => {
          expect(html).toContain('name="color-scheme" content="light"');
          expect(html).not.toContain("prefers-color-scheme");
        });
      }
    });
  }
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/email.test.ts`
Expected: FAIL on "has a fixture" — 44 uncovered keys, since `FIXTURES` is empty.

- [ ] **Step 4: Point the preview at the registry**

Replace the hardcoded `entries` array in `scripts/email-preview.ts` with the registry, so every fixture appears in the gallery automatically:

```ts
import { FIXTURES, previewContext } from "./email-fixtures";
import { renderFor } from "../src/lib/email/send";

async function main() {
  const { ctx, source } = await previewContext();
  const t = themed(ctx);

  const entries = FIXTURES.map((f) => ({
    ...f,
    message: f.build(ctx),
    html: renderFor(ctx, f.build(ctx)),
  }));
  // …write `${f.id}.html` per entry and the index exactly as before…
}
```

Delete the three inline `ticket` / `receipt` / `otp` builders from the script — Tasks 3 and 5 reintroduce them as real template code.

- [ ] **Step 5: Verify the failure is now only coverage**

Run: `npx vitest run tests/email.test.ts 2>&1 | head -20`
Expected: one failing test listing all 44 uncovered keys. This is the checklist the next six tasks work through.

- [ ] **Step 6: Commit**

```bash
git add scripts/email-fixtures.ts scripts/email-preview.ts tests/email.test.ts
git commit -m "Add email fixture registry driving both tests and the preview"
```

---

## Conversion tasks (3–8)

**These six tasks share one shape.** For each file: swap the imports, replace
each template's returned object with the `Message` below, add its fixtures, run
the checks, commit.

**In every conversion task:**

- **Keep the file-level and per-template doc comments verbatim.** They record
  why each message exists — `passwordChanged` explaining account takeover,
  `deletionCompleted` explaining why it is sent before anonymisation. Only the
  returned object changes.
- **Keep every function signature and `data` parameter unchanged.** Callers
  across the app pass these; changing one is out of scope.
- Replace `import type { EmailContext } from "../layout"; import { themed } from "../layout";`
  with `import type { MessageContext } from "../shell"; import { themed } from "../shell";`
  and rename the `ctx` parameter type to `MessageContext`.
- Replace the `../components` import with the equivalent names from `../blocks`.

---

### Task 3: Convert `payments.ts` (6 templates)

Scheduled first: `adminPaymentDigest` is the shape most likely to resist
`MAX_SECTIONS`, and it is cheaper to learn that now than after 38 other
conversions assume the limit holds.

**Files:**
- Modify: `src/lib/email/templates/payments.ts`
- Modify: `scripts/email-fixtures.ts`

**Interfaces:**
- Consumes: `amount`, `facts`, `notice`, `paragraph`, `strong`, `esc` from `../blocks`; `Message` shape from Task 1.
- Produces: six `Message`-returning templates; fixtures `payments/*`.

- [ ] **Step 1: Swap the imports**

```ts
import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { amount, esc, facts, notice, paragraph, strong } from "../blocks";
```

- [ ] **Step 2: Replace each returned object**

`membershipPaymentRequest`:

```ts
  const byCash = data.method === "CASH";
  return {
    subject: `How to pay for your ${data.planName} membership`,
    previewText: `€${data.amount.toFixed(2)} by ${date(data.dueDate)}, quoting ${data.reference}.`,
    eyebrow: "Payment due",
    title: "How to pay",
    accentWord: "pay",
    lead: `${esc(data.name)}, thank you for joining. To activate your ${strong(t, esc(data.planName))} membership, please send the amount below by ${strong(t, esc(date(data.dueDate)))}.`,
    sections: [
      {
        blocks: [
          amount(t, {
            caption: "Amount due",
            amount: data.amount,
            sub: `by ${esc(date(data.dueDate))}`,
          }),
          byCash
            ? notice(t, {
                title: "You chose to pay in cash",
                body: "Bring the amount to the next committee meeting or event and we will record it on the spot. If you would rather transfer it after all, the details are below.",
              })
            : null,
        ],
      },
      {
        label: "Bank transfer",
        blocks: [
          facts(t, [
            { label: "Account holder", value: esc(data.bank.accountHolder || "") },
            { label: "Bank", value: esc(data.bank.bankName || "") },
            { label: "IBAN", value: esc(data.bank.iban || ""), mono: true },
            { label: "BIC", value: esc(data.bank.bic || ""), mono: true },
            { label: "Reference", value: esc(data.reference), mono: true, emphasis: true },
          ]),
          notice(t, {
            title: "Quote the reference exactly",
            body: "It is the only thing that tells us which transfer belongs to which member. Without it your payment sits unmatched and your membership stays inactive.",
          }),
        ],
      },
    ],
    close: {
      eyebrow: "Your membership",
      button: { label: "View my membership", href: absoluteUrl("/profile") },
      note: "Your membership starts on the day we record your payment, and runs a full term from that date. Your invoice is attached to this email.",
    },
  };
```

`membershipPaymentReceived`:

```ts
  return {
    subject: "Payment received — your membership is active",
    previewText: `We have your €${data.amount.toFixed(2)}. Your receipt is attached.`,
    eyebrow: "Receipt",
    title: "Payment received",
    accentWord: "received",
    lead: `${esc(data.name)}, we have recorded your payment for the ${strong(t, esc(data.planName))} membership. It is active from today.`,
    sections: [
      {
        blocks: [
          amount(t, {
            caption: "Paid in full",
            amount: data.amount,
            sub: "Your receipt is attached as a PDF — keep it for your records.",
          }),
        ],
      },
      {
        label: "Your membership term",
        blocks: [
          facts(t, [
            { label: "Plan", value: esc(data.planName) },
            { label: "Member since", value: esc(date(data.startDate)) },
            { label: "Valid until", value: esc(date(data.endDate)), emphasis: true },
            { label: "Term", value: esc(data.term) },
            data.reference
              ? { label: "Reference", value: esc(data.reference), mono: true }
              : null,
          ]),
        ],
      },
    ],
    close: {
      eyebrow: "Your account",
      button: { label: "Go to my profile", href: absoluteUrl("/profile") },
      note: "We will remind you before the term is up.",
    },
  };
```

`eventPaymentRecorded`:

```ts
  const methodLabel = data.method === "CASH" ? "Cash" : "Bank transfer";
  return {
    subject: `Payment received for ${data.eventTitle}`,
    previewText: `€${data.amount.toFixed(2)} received. Nothing further to pay at the door.`,
    eyebrow: "Receipt",
    title: "Payment received",
    accentWord: "received",
    lead: `${esc(data.name)}, we have recorded your payment for ${strong(t, esc(data.eventTitle))}. There is nothing left to settle — just bring your ticket.`,
    sections: [
      { blocks: [amount(t, { caption: "Paid in full", amount: data.amount })] },
      {
        label: "Receipt",
        blocks: [
          facts(t, [
            { label: "Event", value: esc(data.eventTitle) },
            { label: "Method", value: esc(methodLabel) },
            { label: "Received", value: esc(date(data.paidAt)) },
            { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
            data.reference
              ? { label: "Reference", value: esc(data.reference), mono: true }
              : null,
          ]),
        ],
      },
    ],
    close: {
      eyebrow: "The event",
      button: {
        label: "View event details",
        href: absoluteUrl(`/events/${data.eventSlug}`),
      },
      note: "Treat this email as your receipt. Your original ticket PDF is still the one to bring — it is valid whether or not it was paid when it was issued.",
    },
  };
```

`eventPaymentReverted`:

```ts
  return {
    subject: `Correction: payment for ${data.eventTitle}`,
    previewText: "We have reversed a payment record on your registration.",
    eyebrow: "Correction",
    title: "We corrected our records",
    accentWord: "corrected",
    lead: `${esc(data.name)}, we had recorded a payment of ${strong(t, `€${data.amount.toFixed(2)}`)} against your registration for ${strong(t, esc(data.eventTitle))}, and that entry has been reversed.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            "This almost always means a bookkeeping mix-up on our side rather than anything to do with you — for example, a transfer matched to the wrong registration."
          ),
        ],
      },
      {
        label: "Your registration",
        blocks: [
          facts(t, [
            { label: "Event", value: esc(data.eventTitle) },
            { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
            { label: "Balance", value: `€${data.amount.toFixed(2)} outstanding` },
          ]),
          notice(t, {
            title: "Already paid?",
            body: "Reply to this email with the date and reference and we will fix it straight away. Otherwise the desk will ask for it at the door.",
          }),
        ],
      },
    ],
    close: {
      button: {
        label: "View event details",
        href: absoluteUrl(`/events/${data.eventSlug}`),
      },
    },
  };
```

`paymentOverdue`:

```ts
  return {
    subject: data.finalNotice
      ? `Second reminder — your ${data.planName} payment`
      : `Reminder — your ${data.planName} payment`,
    previewText: `€${data.amount.toFixed(2)} was due on ${date(data.dueDate)}, quoting ${data.reference}.`,
    eyebrow: data.finalNotice ? "Second reminder" : "Payment reminder",
    title: data.finalNotice ? "A second reminder" : "A gentle reminder",
    accentWord: data.finalNotice ? "second" : "gentle",
    lead: `${esc(data.name)}, we have not yet been able to match a payment for your ${strong(t, esc(data.planName))} membership, which was due ${strong(t, `${data.daysOverdue} days ago`)}. Your membership will not start until it arrives.`,
    sections: [
      {
        blocks: [
          amount(t, {
            caption: "Still outstanding",
            amount: data.amount,
            sub: `was due ${esc(date(data.dueDate))}`,
          }),
        ],
      },
      {
        label: "Bank transfer",
        blocks: [
          facts(t, [
            { label: "Account holder", value: esc(data.bank.accountHolder || "") },
            { label: "IBAN", value: esc(data.bank.iban || ""), mono: true },
            { label: "BIC", value: esc(data.bank.bic || ""), mono: true },
            { label: "Reference", value: esc(data.reference), mono: true, emphasis: true },
          ]),
          notice(t, {
            title: "Already paid?",
            body: "Then it is very likely a transfer that reached us without the reference, and we simply could not tell whose it was. Reply with the date and amount and we will match it by hand.",
          }),
        ],
      },
    ],
    close: {
      note: data.finalNotice
        ? "If we do not hear from you we will close the application in a few weeks. Nothing is owed if you have changed your mind — just let us know."
        : "If you would rather pay in cash, bring it to the next event and we will record it there.",
    },
  };
```

`adminPaymentDigest` — two panels, exactly at `MAX_SECTIONS`:

```ts
  return {
    subject: `Weekly summary — ${data.recorded} payments recorded`,
    previewText: `€${data.recordedTotal.toFixed(2)} in, €${data.outstandingTotal.toFixed(2)} outstanding.`,
    eyebrow: "Committee",
    title: "This week in payments",
    accentWord: "payments",
    lead: `${data.recorded} payment${data.recorded === 1 ? "" : "s"} recorded and ${data.outstanding} still awaited.`,
    sections: [
      {
        label: "Money in",
        blocks: [
          facts(t, [
            { label: "Payments recorded", value: String(data.recorded), emphasis: true },
            { label: "Value", value: `€${data.recordedTotal.toFixed(2)}` },
            { label: "New applications", value: String(data.newApplications) },
          ]),
        ],
      },
      {
        label: "Money owed",
        blocks: [
          facts(t, [
            { label: "Awaiting payment", value: String(data.outstanding), emphasis: true },
            { label: "Value", value: `€${data.outstandingTotal.toFixed(2)}` },
            { label: "Past due date", value: String(data.overdue) },
          ]),
        ],
      },
    ],
    close: {
      button: { label: "Open the payments ledger", href: absoluteUrl("/admin/payments") },
    },
  };
```

- [ ] **Step 3: Add the fixtures**

Append to `FIXTURES` in `scripts/email-fixtures.ts`:

```ts
  { id: "payments-request", group: "payments", name: "membershipPaymentRequest",
    build: (ctx) => templates.payments.membershipPaymentRequest(ctx, {
      name: "Ammu", planName: "Family", amount: 45, reference: "KSA-MEM-2026-0417",
      dueDate: new Date("2026-09-30"), bank: BANK, method: "BANK" }) },
  { id: "payments-received", group: "payments", name: "membershipPaymentReceived",
    build: (ctx) => templates.payments.membershipPaymentReceived(ctx, {
      name: "Ammu", planName: "Family", amount: 45,
      startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"),
      term: "12 months", reference: "KSA-MEM-2026-0417" }) },
  { id: "payments-event-recorded", group: "payments", name: "eventPaymentRecorded",
    build: (ctx) => templates.payments.eventPaymentRecorded(ctx, {
      name: "Ammu", eventTitle: EVENT.title, eventSlug: EVENT.slug,
      ticketId: "KSA-8F42-9C11", amount: 36, method: "CASH",
      paidAt: new Date("2026-08-14"), reference: null }) },
  { id: "payments-event-reverted", group: "payments", name: "eventPaymentReverted",
    build: (ctx) => templates.payments.eventPaymentReverted(ctx, {
      name: "Ammu", eventTitle: EVENT.title, eventSlug: EVENT.slug,
      ticketId: "KSA-8F42-9C11", amount: 36 }) },
  { id: "payments-overdue", group: "payments", name: "paymentOverdue",
    build: (ctx) => templates.payments.paymentOverdue(ctx, {
      name: "Ammu", planName: "Family", amount: 45, reference: "KSA-MEM-2026-0417",
      dueDate: new Date("2026-07-01"), daysOverdue: 46, bank: BANK, finalNotice: true }) },
  { id: "payments-digest", group: "payments", name: "adminPaymentDigest",
    build: (ctx) => templates.payments.adminPaymentDigest(ctx, {
      recorded: 7, recordedTotal: 315, outstanding: 3, outstandingTotal: 135,
      overdue: 1, newApplications: 2 }) },
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run tests/email.test.ts && npm run email:preview`
Expected: typecheck clean; the six `payments/*` fixtures pass every invariant; the coverage test still fails listing the remaining 38. Open `.email-preview/index.html` and confirm the six render.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates/payments.ts scripts/email-fixtures.ts
git commit -m "Convert payment emails to the new shell"
```

---

### Task 4: Convert `account.ts` (6 templates)

**Files:**
- Modify: `src/lib/email/templates/account.ts`
- Modify: `scripts/email-fixtures.ts`

**Interfaces:**
- Consumes: `bulletList`, `code`, `esc`, `facts`, `notice`, `paragraph`, `strong` from `../blocks`.
- Produces: six `Message`-returning templates; fixtures `account/*`.

- [ ] **Step 1: Swap the imports**

```ts
import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { bulletList, code, esc, facts, notice, paragraph, strong } from "../blocks";
```

- [ ] **Step 2: Replace each returned object**

```ts
// verifyEmail
  return {
    subject: "Confirm your email address",
    previewText: "One click and your account is ready. The link is good for 24 hours.",
    eyebrow: "Confirm your account",
    title: "Confirm your email address",
    accentWord: "Confirm",
    lead: `Welcome to ${esc(ctx.siteName)}. Confirm this address and your member portal is ready to use.`,
    sections: [],
    close: {
      button: { label: "Verify my email", href: data.verifyLink },
      note: "This link expires in 24 hours. If you did not create an account you can ignore this message — nothing happens without the confirmation.",
    },
  };

// welcome
  return {
    subject: `Welcome to ${ctx.siteName}`,
    previewText: "Your account is active. Here is what you can do with it.",
    eyebrow: "Welcome",
    title: `Namaskaram, ${data.name}`,
    accentWord: data.name,
    lead: "Your email is confirmed and your account is active. You are now part of the community.",
    sections: [
      {
        label: "What you can do",
        blocks: [
          bulletList(t, [
            `${strong(t, "Book events")} — register for gatherings, festivals and socials.`,
            `${strong(t, "Become a member")} — members pay less at events and can vote at the general meeting.`,
            `${strong(t, "Share photographs")} — contribute your pictures to the community albums.`,
          ]),
        ],
      },
    ],
    close: {
      eyebrow: "Get started",
      button: { label: "Explore upcoming events", href: absoluteUrl("/events") },
      note: "Questions at any point? Reply to this email and a person will read it.",
    },
  };

// otpCode
  return {
    subject: `${data.code} is your verification code`,
    previewText: "Enter it within 10 minutes to continue.",
    eyebrow: "Verification code",
    title: "Your code is below",
    accentWord: "code",
    lead: "Enter this to continue with your membership application. It is valid for 10 minutes.",
    sections: [{ blocks: [code(t, data.code)] }],
    close: {
      note: "If you did not ask for this code, someone may have typed your address by mistake. You can ignore this message.",
    },
  };

// passwordReset
  return {
    subject: "Set a new password",
    previewText: "A link to choose a new password. It expires in one hour.",
    eyebrow: "Security",
    title: "Set a new password",
    accentWord: "new",
    lead: "We received a request to reset the password for your account. Use the button below to choose a new one.",
    sections: [
      {
        blocks: [
          notice(t, {
            title: "Didn't request this?",
            body: "Then no action is needed — your password has not changed. If you keep receiving these, reply and tell us.",
          }),
        ],
      },
    ],
    close: {
      button: { label: "Choose a new password", href: data.resetLink },
      note: "The link expires in one hour and can be used once.",
    },
  };

// passwordChanged
  return {
    subject: "Your password was changed",
    previewText: "Confirming a change on your account. If this wasn't you, act now.",
    eyebrow: "Security notice",
    title: "Your password was changed",
    accentWord: "changed",
    lead: `${esc(data.name)}, the password on your account was changed and every signed-in device has been signed out.`,
    sections: [
      {
        label: "What happened",
        blocks: [
          facts(t, [
            {
              label: "Changed",
              value: esc(
                new Date(data.changedAt).toLocaleString("en-GB", {
                  dateStyle: "full",
                  timeStyle: "short",
                })
              ),
            },
          ]),
          notice(t, {
            title: "If this wasn't you",
            body: `Your account may be compromised. Reset your password immediately, then write to <a href="mailto:${esc(ctx.contactEmail)}" style="color:${t.primaryDeep};font-weight:700;">${esc(ctx.contactEmail)}</a>.`,
          }),
        ],
      },
    ],
    close: {
      button: { label: "Reset my password", href: absoluteUrl("/forgot-password") },
      note: "You are receiving this because it affects your account's security.",
    },
  };

// emailChanged
  const toOld = data.audience === "old";
  return {
    subject: "Your sign-in address was changed",
    previewText: toOld
      ? "Your account now uses a different email address. If this wasn't you, act now."
      : "This address is now the sign-in address for your account.",
    eyebrow: "Security notice",
    title: "Your sign-in address changed",
    accentWord: "changed",
    lead: `${esc(data.name)}, the email address on your ${esc(ctx.siteName)} account was updated.`,
    sections: [
      {
        label: "The change",
        blocks: [
          facts(t, [
            { label: "Previous", value: esc(data.oldEmail) },
            { label: "New", value: esc(data.newEmail), emphasis: true },
          ]),
          toOld
            ? notice(t, {
                title: "If you did not make this change",
                body: `Contact us straight away at <a href="mailto:${esc(ctx.contactEmail)}" style="color:${t.primaryDeep};font-weight:700;">${esc(ctx.contactEmail)}</a>. This is the last message we can send to this address.`,
              })
            : paragraph(t, "Sign in with this address from now on. Your password is unchanged."),
        ],
      },
    ],
    close: {
      note: "You are receiving this because it affects how you sign in.",
    },
  };
```

- [ ] **Step 3: Add the fixtures**

```ts
  { id: "account-verify", group: "account", name: "verifyEmail",
    build: (ctx) => templates.account.verifyEmail(ctx, { verifyLink: "https://keralasamajam.de/verify?t=abc" }) },
  { id: "account-welcome", group: "account", name: "welcome",
    build: (ctx) => templates.account.welcome(ctx, { name: "Ammu" }) },
  { id: "account-otp", group: "account", name: "otpCode",
    build: (ctx) => templates.account.otpCode(ctx, { code: "482913" }) },
  { id: "account-reset", group: "account", name: "passwordReset",
    build: (ctx) => templates.account.passwordReset(ctx, { resetLink: "https://keralasamajam.de/reset?t=abc" }) },
  { id: "account-password-changed", group: "account", name: "passwordChanged",
    build: (ctx) => templates.account.passwordChanged(ctx, { name: "Ammu", changedAt: new Date("2026-08-16T09:20:00Z") }) },
  { id: "account-email-changed", group: "account", name: "emailChanged",
    build: (ctx) => templates.account.emailChanged(ctx, {
      name: "Ammu", oldEmail: "old@example.org", newEmail: "new@example.org", audience: "old" }) },
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run tests/email.test.ts && npm run email:preview`
Expected: `account/*` and `payments/*` pass; 32 keys remain uncovered.

Check `welcome` specifically: its `accentWord` is the member's name, so the
accent test proves the name reached the title unmangled.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates/account.ts scripts/email-fixtures.ts
git commit -m "Convert account and security emails to the new shell"
```

---

### Task 5: Convert `events.ts` (10 templates)

The largest file, and the only one using `eventFacts`. Note the shared helper
change: `EventSummary extends EventCardData` becomes `EventSummary extends
EventFacts`, imported from `../blocks`.

**Files:**
- Modify: `src/lib/email/templates/events.ts`
- Modify: `scripts/email-fixtures.ts`

**Interfaces:**
- Consumes: `amount`, `esc`, `eventFacts`, `facts`, `notice`, `paragraph`, `quote`, `strong`, `type EventFacts` from `../blocks`.
- Produces: ten `Message`-returning templates; `EventSummary extends EventFacts`; fixtures `events/*`.

- [ ] **Step 1: Swap the imports and the shared interface**

```ts
import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import {
  amount, esc, eventFacts, facts, notice, paragraph, quote, strong,
  type EventFacts,
} from "../blocks";

export interface EventSummary extends EventFacts {
  slug: string;
}

const eventUrl = (slug: string) => absoluteUrl(`/events/${slug}`);
```

- [ ] **Step 2: Replace each returned object**

```ts
// ticket
  const owed = data.amountDue > 0;
  return {
    subject: `You're in — ${data.event.title}`,
    previewText: `Ticket ${data.ticketId} is attached as a PDF.`,
    eyebrow: "Event ticket",
    title: "You're on the list",
    accentWord: "list",
    lead: `${esc(data.name)}, your place at ${strong(t, esc(data.event.title))} is confirmed. Your ticket is attached as a PDF — keep it on your phone, or bring a printout.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          eventFacts(t, data.event),
          facts(t, [
            { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
            { label: "Attendees", value: String(data.attendees) },
          ]),
        ],
      },
      owed
        ? {
            label: "At the door",
            blocks: [
              amount(t, {
                caption: "Still to pay",
                amount: data.amountDue,
                sub: "Your ticket is valid either way — settle up with the desk when you arrive. Cash is fine.",
              }),
            ],
          }
        : { blocks: [] },
    ],
    close: {
      eyebrow: "See you there",
      button: { label: "View event details", href: eventUrl(data.event.slug) },
      note: "Need to change or cancel? You can do that from the event page, or just reply to this email.",
    },
  };

// registrationCancelled
  return {
    subject: `Cancelled — your place at ${data.event.title}`,
    previewText: `Ticket ${data.ticketId} is no longer valid.`,
    eyebrow: "Registration cancelled",
    title: "Your registration is cancelled",
    accentWord: "cancelled",
    lead: `${esc(data.name)}, we have released your place at ${strong(t, esc(data.event.title))}. Ticket ${esc(data.ticketId)} will not be admitted.`,
    sections: [{ label: data.event.title, blocks: [eventFacts(t, data.event)] }],
    close: {
      eyebrow: "Changed your mind?",
      button: { label: "Register again", href: eventUrl(data.event.slug) },
      note: "If you had already paid, reply to this email and we will arrange the refund.",
    },
  };

// registrationRemovedByAdmin
  return {
    subject: `We cancelled your place at ${data.event.title}`,
    previewText: `Ticket ${data.ticketId} will not be admitted.`,
    eyebrow: "Registration cancelled",
    title: "Your registration was cancelled",
    accentWord: "cancelled",
    lead: `${esc(data.name)}, we have cancelled your registration for ${strong(t, esc(data.event.title))}. Ticket ${esc(data.ticketId)} will not be admitted.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          data.reason ? quote(t, data.reason) : null,
          eventFacts(t, data.event),
          notice(t, {
            title: "Not expecting this?",
            body: `Get in touch — reply to this email or write to <a href="mailto:${esc(ctx.contactEmail)}" style="color:${t.primaryDeep};font-weight:600;">${esc(ctx.contactEmail)}</a> and we will sort it out. Anything already paid will be refunded.`,
          }),
        ],
      },
    ],
    close: {
      note: "You are receiving this because it affects a booking you made.",
    },
  };

// registrationCancelledAdminNotice
  return {
    subject: `Cancellation: ${data.name} — ${data.event.title}`,
    previewText: `${data.attendees} place(s) released.`,
    eyebrow: "Committee",
    title: "A registration was cancelled",
    accentWord: "cancelled",
    lead: `${strong(t, esc(data.name))} released ${strong(t, String(data.attendees))} place(s) at ${esc(data.event.title)}.`,
    sections: [
      {
        label: "Cancellation",
        blocks: [
          facts(t, [
            { label: "Member", value: esc(data.name), emphasis: true },
            { label: "Email", value: esc(data.email) },
            { label: "Event", value: esc(data.event.title) },
            { label: "Places released", value: String(data.attendees) },
            { label: "Payment", value: data.hadPaid ? "Recorded as paid" : "Nothing recorded" },
          ]),
          data.hadPaid
            ? notice(t, {
                title: "Action needed",
                body: "This registration was already marked paid. Arrange the refund.",
              })
            : null,
        ],
      },
    ],
    close: {
      button: { label: "Open registrations", href: absoluteUrl("/admin/registrations") },
    },
  };

// eventCancelled
  return {
    subject: `Cancelled — ${data.event.title}`,
    previewText: "The event will not take place. Here is what happens next.",
    eyebrow: "Event cancelled",
    title: "This event has been cancelled",
    accentWord: "cancelled",
    lead: `${esc(data.name)}, we are sorry to tell you that ${strong(t, esc(data.event.title))} will not go ahead. We know this is disappointing, and we did not take the decision lightly.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          data.reason ? quote(t, data.reason) : null,
          eventFacts(t, data.event),
          data.hadPaid
            ? notice(t, {
                title: "Your refund",
                body: "We have your payment on record and will return it in full to the account it came from. Allow a few working days — you do not need to do anything.",
              })
            : paragraph(t, "Nothing was collected from you, so there is nothing to refund."),
        ],
      },
    ],
    close: {
      eyebrow: "What's next",
      button: { label: "See other events", href: absoluteUrl("/events") },
      note: "Your ticket is void. We hope to see you at the next one.",
    },
  };

// eventRescheduled
  const venueMoved = !!data.previousLocation && data.previousLocation !== data.event.location;
  return {
    subject: `Changed — ${data.event.title}`,
    previewText: "New details. Your existing ticket is still valid.",
    eyebrow: "Details changed",
    title: venueMoved ? "This event has moved" : "This event has a new date",
    accentWord: venueMoved ? "moved" : "new",
    lead: `${esc(data.name)}, the details for ${strong(t, esc(data.event.title))} have changed. ${strong(t, "Your existing ticket is still valid")} — there is nothing to re-book.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          data.reason ? quote(t, data.reason) : null,
          eventFacts(t, { ...data.event, previousDate: data.previousDate }),
          venueMoved
            ? facts(t, [
                {
                  label: "Was",
                  value: `<span style="text-decoration:line-through;color:${t.muted};font-weight:500;">${esc(data.previousLocation!)}</span>`,
                },
                { label: "Now", value: esc(data.event.location), emphasis: true },
              ])
            : null,
        ],
      },
    ],
    close: {
      button: { label: "View updated details", href: eventUrl(data.event.slug) },
      note: "If the new arrangements do not work for you, you can cancel from the event page and we will refund anything already paid.",
    },
  };

// eventReminder
  const soon = data.when === "same-day";
  return {
    subject: soon ? `Today — ${data.event.title}` : `In two days — ${data.event.title}`,
    previewText: `Ticket ${data.ticketId}. Bring it on your phone or printed.`,
    eyebrow: soon ? "Today" : "In two days",
    title: soon ? "See you today" : "Coming up in two days",
    accentWord: soon ? "today" : "two days",
    lead: `${esc(data.name)}, a reminder that you are registered for ${strong(t, esc(data.event.title))}.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          eventFacts(t, data.event),
          facts(t, [
            { label: "Ticket", value: esc(data.ticketId), mono: true, emphasis: true },
            { label: "Attendees", value: String(data.attendees) },
          ]),
          data.amountDue > 0
            ? notice(t, {
                title: `€${data.amountDue.toFixed(2)} to pay at the door`,
                body: "Bringing the exact amount in cash helps the desk move faster.",
              })
            : null,
        ],
      },
    ],
    close: {
      button: { label: "View event details", href: eventUrl(data.event.slug) },
      note: "Can no longer make it? Cancel from the event page so someone on the waiting list can take your place.",
    },
  };

// eventThankYou
  return {
    subject: `Thank you for coming to ${data.event.title}`,
    previewText: "Photographs are going up, and here is what's next.",
    eyebrow: "Thank you",
    title: "Thank you for being there",
    accentWord: "Thank you",
    lead: `${esc(data.name)}, thank you for joining us at ${strong(t, esc(data.event.title))}. Events like this only work because people turn up, and you did.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            data.galleryUrl
              ? "Photographs from the day are going up now. If you took some of your own, we would love to add them to the album."
              : "Photographs will go up in the gallery shortly."
          ),
        ],
      },
    ],
    close: {
      eyebrow: "The photographs",
      button: data.galleryUrl
        ? { label: "See the photographs", href: data.galleryUrl }
        : { label: "Browse the gallery", href: absoluteUrl("/gallery") },
      note: "Anything we could do better? Reply to this email — it goes to the committee, and we read all of it.",
    },
  };

// eventAnnouncement
  const summary = data.description.replace(/<[^>]+>/g, "").slice(0, 220);
  return {
    subject: `New event — ${data.event.title}`,
    previewText: summary,
    eyebrow: "New event",
    title: data.event.title,
    accentWord: data.event.title.split(" ")[0],
    lead: `${esc(data.name)}, we have just announced a new event and wanted you to hear first.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          paragraph(t, esc(summary) + (data.description.length > 220 ? "…" : "")),
          eventFacts(t, data.event),
        ],
      },
      {
        label: "Tickets",
        blocks: [
          facts(t, [
            data.memberPrice != null
              ? { label: "Members", value: `€${data.memberPrice.toFixed(2)}`, emphasis: true }
              : null,
            data.nonMemberPrice != null
              ? { label: "Non-members", value: `€${data.nonMemberPrice.toFixed(2)}` }
              : null,
          ]),
        ],
      },
    ],
    close: {
      button: { label: "Reserve your place", href: eventUrl(data.event.slug) },
    },
  };

// eventFull
  return {
    subject: `${data.event.title} is full`,
    previewText: "We could not fit you in this time — here is how to hear first next time.",
    eyebrow: "At capacity",
    title: "We're full",
    accentWord: "full",
    lead: `${esc(data.name)}, we are sorry — ${strong(t, esc(data.event.title))} reached capacity before your registration went through, so we could not reserve a place for you.`,
    sections: [
      {
        label: data.event.title,
        blocks: [
          eventFacts(t, data.event),
          paragraph(
            t,
            "Places sometimes open up when others cancel. Keep an eye on the event page, and if one appears you can grab it."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Check the event page", href: eventUrl(data.event.slug) },
      note: "Members get advance notice of new events, which is usually the difference between getting a place and reading this email.",
    },
  };
```

- [ ] **Step 3: Add the fixtures**

```ts
  { id: "events-ticket", group: "events", name: "ticket",
    build: (ctx) => templates.events.ticket(ctx, { name: "Ammu", event: EVENT,
      ticketId: "KSA-8F42-9C11", attendees: 4, amountDue: 36, pricePaid: 0 }) },
  { id: "events-cancelled-self", group: "events", name: "registrationCancelled",
    build: (ctx) => templates.events.registrationCancelled(ctx, { name: "Ammu", event: EVENT, ticketId: "KSA-8F42-9C11" }) },
  { id: "events-removed", group: "events", name: "registrationRemovedByAdmin",
    build: (ctx) => templates.events.registrationRemovedByAdmin(ctx, { name: "Ammu", event: EVENT,
      ticketId: "KSA-8F42-9C11", reason: "Duplicate booking under the same name." }) },
  { id: "events-cancel-notice", group: "events", name: "registrationCancelledAdminNotice",
    build: (ctx) => templates.events.registrationCancelledAdminNotice(ctx, { name: "Ammu",
      email: "ammu@example.org", event: EVENT, attendees: 4, hadPaid: true }) },
  { id: "events-event-cancelled", group: "events", name: "eventCancelled",
    build: (ctx) => templates.events.eventCancelled(ctx, { name: "Ammu", event: EVENT,
      reason: "The venue withdrew at short notice.", hadPaid: true }) },
  { id: "events-rescheduled", group: "events", name: "eventRescheduled",
    build: (ctx) => templates.events.eventRescheduled(ctx, { name: "Ammu", event: EVENT,
      previousDate: new Date("2026-09-05T17:00:00Z"), previousLocation: "Kongress am Park", reason: null as unknown as undefined }) },
  { id: "events-reminder", group: "events", name: "eventReminder",
    build: (ctx) => templates.events.eventReminder(ctx, { name: "Ammu", event: EVENT,
      ticketId: "KSA-8F42-9C11", attendees: 4, amountDue: 36, when: "same-day" }) },
  { id: "events-thank-you", group: "events", name: "eventThankYou",
    build: (ctx) => templates.events.eventThankYou(ctx, { name: "Ammu", event: EVENT, galleryUrl: null }) },
  { id: "events-announcement", group: "events", name: "eventAnnouncement",
    build: (ctx) => templates.events.eventAnnouncement(ctx, { name: "Ammu", event: EVENT,
      description: "An afternoon of sadhya, dance and music at the Zeughaus. Doors from five.",
      memberPrice: 12, nonMemberPrice: 18 }) },
  { id: "events-full", group: "events", name: "eventFull",
    build: (ctx) => templates.events.eventFull(ctx, { name: "Ammu", event: EVENT }) },
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run tests/email.test.ts && npm run email:preview`
Expected: 22 fixtures pass; 22 keys remain. Check `ticket` in the gallery — it
is the most complex message and the one whose `owed: false` branch produces an
empty second section, which the shell must drop rather than render as a blank panel.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates/events.ts scripts/email-fixtures.ts
git commit -m "Convert event lifecycle emails to the new shell"
```

---

### Task 6: Convert `membership.ts` (9 templates)

**Files:**
- Modify: `src/lib/email/templates/membership.ts`
- Modify: `scripts/email-fixtures.ts`

**Interfaces:**
- Consumes: `bulletList`, `esc`, `facts`, `notice`, `paragraph`, `quote`, `steps`, `strong` from `../blocks`.
- Produces: nine `Message`-returning templates; fixtures `membership/*`.

- [ ] **Step 1: Swap the imports**

```ts
import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { bulletList, esc, facts, notice, paragraph, quote, steps, strong } from "../blocks";
```

- [ ] **Step 2: Replace each returned object**

```ts
// studentApplicationReceived
  return {
    subject: `We have your ${data.planName} application`,
    previewText: "We are checking your student ID and will be in touch.",
    eyebrow: "Application received",
    title: "Application received",
    accentWord: "received",
    lead: `Thank you, ${esc(data.name)}. Your application for the ${strong(t, esc(data.planName))} membership is with us and is pending verification.`,
    sections: [
      {
        label: "What happens next",
        blocks: [
          steps(t, [
            "A committee member checks your student ID — usually within a few days.",
            "Once confirmed, we send you the bank details and your payment reference.",
            `${strong(t, "Your term starts on the day we record your payment")}, not today.`,
          ]),
          notice(t, {
            body: "We have not asked you for any money yet, and will not until your status is confirmed.",
          }),
        ],
      },
    ],
    close: {
      button: { label: "View my application", href: absoluteUrl("/profile") },
    },
  };

// applicationReceived
  return {
    subject: `We have your ${data.planName} application`,
    previewText: "Payment details are on their way in a separate email.",
    eyebrow: "Application received",
    title: "Application received",
    accentWord: "received",
    lead: `Thank you, ${esc(data.name)}. Your application for the ${strong(t, esc(data.planName))} membership has been recorded.`,
    sections: [
      {
        label: "Your application",
        blocks: [
          facts(t, [
            { label: "Plan", value: esc(data.planName) },
            { label: "Contribution", value: `€${data.amount.toFixed(2)}`, emphasis: true },
          ]),
        ],
      },
      {
        label: "What happens next",
        blocks: [
          steps(t, [
            "A separate email follows straight after this one with the bank details, your payment reference and your invoice as a PDF.",
            "You transfer the amount, quoting the reference exactly.",
            `${strong(t, "Your membership begins the day we record your payment")} and runs a full term from that date.`,
          ]),
        ],
      },
    ],
    close: {
      note: "Nothing to do right now — watch for the payment email.",
    },
  };

// applicationAdminNotice
  return {
    subject: `Student verification needed: ${data.memberName}`,
    previewText: `${data.memberName} applied for ${data.planName}.`,
    eyebrow: "Committee",
    title: "A student application needs review",
    accentWord: "review",
    lead: `${strong(t, esc(data.memberName))} has applied for the ${esc(data.planName)} membership and their ID needs checking.`,
    sections: [
      {
        label: "Applicant",
        blocks: [
          facts(t, [
            { label: "Name", value: esc(data.memberName), emphasis: true },
            { label: "Email", value: esc(data.memberEmail) },
            { label: "Plan", value: esc(data.planName) },
          ]),
        ],
      },
    ],
    close: {
      button: { label: "Review the application", href: absoluteUrl("/admin/membership/applications") },
      note: "Nobody has been asked to pay yet — the payment request goes out automatically once you approve.",
    },
  };

// studentVerified
  return {
    subject: "Your student status is verified",
    previewText: "Payment details follow in the next email.",
    eyebrow: "Verified",
    title: "Student status verified",
    accentWord: "verified",
    lead: `Good news, ${esc(data.name)} — we have confirmed your student status for the ${strong(t, esc(data.planName))} membership.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            "The payment details and your invoice follow in a separate email. Your membership starts on the day we record the payment, and we will confirm the exact dates then."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Go to my profile", href: absoluteUrl("/profile") },
    },
  };

// applicationRejected
  return {
    subject: `About your ${data.planName} application`,
    previewText: "We could not verify your student status this time.",
    eyebrow: "Application update",
    title: "We could not verify your application",
    accentWord: "verify",
    lead: `${esc(data.name)}, we have reviewed your application for the ${strong(t, esc(data.planName))} membership and were not able to confirm your student status.`,
    sections: [
      {
        blocks: [
          data.reason ? quote(t, data.reason) : null,
          paragraph(
            t,
            "This is usually something small — a photograph that is hard to read, or an enrolment date that has passed. You are very welcome to apply again with a clearer image."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Apply again", href: absoluteUrl("/membership") },
      note: "If you think we have this wrong, reply to this email and a person will look at it again.",
    },
  };

// membershipActive
  return {
    subject: `You're a member of ${ctx.siteName}`,
    previewText: "Your membership is active. Here is what comes with it.",
    eyebrow: "Membership active",
    title: `Welcome, ${data.name}`,
    accentWord: data.name,
    lead: `Your ${strong(t, esc(data.planName))} membership is active. Thank you for supporting the association — subscriptions are what pay for the hall, the sound system and the sadya.`,
    sections: [
      {
        label: "Your membership",
        blocks: [
          facts(t, [
            { label: "Plan", value: esc(data.planName) },
            { label: "Member since", value: esc(date(data.startDate)) },
            { label: "Valid until", value: esc(date(data.endDate)), emphasis: true },
          ]),
        ],
      },
      {
        label: "What comes with it",
        blocks: [
          bulletList(
            t,
            data.features.length
              ? data.features.slice(0, 6).map((f) => esc(f))
              : [
                  `${strong(t, "Member pricing")} at every event we run.`,
                  `${strong(t, "A vote")} at the general meeting.`,
                  `${strong(t, "Early notice")} of events that fill up.`,
                ]
          ),
        ],
      },
    ],
    close: {
      eyebrow: "Your account",
      button: { label: "Go to my profile", href: absoluteUrl("/profile") },
      note: "We will remind you well before your membership is due for renewal.",
    },
  };

// membershipExpiring
  const urgent = data.daysLeft <= 7;
  return {
    subject: urgent
      ? `Your membership ends in ${data.daysLeft} days`
      : "Your membership renews next month",
    previewText: `The ${data.planName} term expires on ${date(data.endDate)}.`,
    eyebrow: urgent ? `${data.daysLeft} days left` : "Renewal due",
    title: urgent ? "Your membership is about to end" : "Time to renew",
    accentWord: urgent ? "end" : "renew",
    lead: `${esc(data.name)}, your ${strong(t, esc(data.planName))} membership runs out in ${strong(t, `${data.daysLeft} days`)}. Renewing keeps your member pricing and your vote without a gap.`,
    sections: [
      {
        label: "Renewal",
        blocks: [
          facts(t, [
            { label: "Expires", value: esc(date(data.endDate)), emphasis: true },
            { label: "Amount", value: `€${data.amount.toFixed(2)}` },
          ]),
          paragraph(
            t,
            "Renew before the expiry date and your new term picks up where this one ends — no lost days.",
            { small: true, muted: true }
          ),
        ],
      },
    ],
    close: {
      button: { label: "Renew my membership", href: absoluteUrl("/membership") },
    },
  };

// membershipExpired
  return {
    subject: "Your membership has expired",
    previewText: `The ${data.planName} term ended on ${date(data.endDate)}. You can rejoin any time.`,
    eyebrow: "Membership expired",
    title: "Your membership has ended",
    accentWord: "ended",
    lead: `${esc(data.name)}, your ${strong(t, esc(data.planName))} membership expired on ${strong(t, esc(date(data.endDate)))}.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            "You are still very much part of the community — you will simply pay the non-member price at events, and you cannot vote at the general meeting until you rejoin."
          ),
          paragraph(
            t,
            "Rejoining takes a minute and starts a fresh term from the day your payment is recorded."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Rejoin", href: absoluteUrl("/membership") },
      note: "If you have decided not to continue, thank you for the time you gave us. You are welcome back whenever.",
    },
  };

// membershipRenewed
  return {
    subject: "Your membership is renewed",
    previewText: `Renewed through ${date(data.endDate)}. Thank you.`,
    eyebrow: "Renewed",
    title: "Renewed — thank you",
    accentWord: "Renewed",
    lead: `${esc(data.name)}, your ${strong(t, esc(data.planName))} membership has been renewed for another term.`,
    sections: [
      {
        label: "New term",
        blocks: [
          facts(t, [
            { label: "Begins", value: esc(date(data.startDate)) },
            { label: "Valid until", value: esc(date(data.endDate)), emphasis: true },
          ]),
          paragraph(t, "Nothing else changes — same member pricing, same access, no gap.", {
            small: true,
            muted: true,
          }),
        ],
      },
    ],
    close: {
      button: { label: "Go to my profile", href: absoluteUrl("/profile") },
    },
  };
```

- [ ] **Step 3: Add the fixtures**

```ts
  { id: "membership-student-applied", group: "membership", name: "studentApplicationReceived",
    build: (ctx) => templates.membership.studentApplicationReceived(ctx, { name: "Ammu", planName: "Student" }) },
  { id: "membership-applied", group: "membership", name: "applicationReceived",
    build: (ctx) => templates.membership.applicationReceived(ctx, { name: "Ammu", planName: "Family", amount: 45 }) },
  { id: "membership-admin-notice", group: "membership", name: "applicationAdminNotice",
    build: (ctx) => templates.membership.applicationAdminNotice(ctx, { memberName: "Ammu",
      memberEmail: "ammu@example.org", planName: "Student" }) },
  { id: "membership-student-verified", group: "membership", name: "studentVerified",
    build: (ctx) => templates.membership.studentVerified(ctx, { name: "Ammu", planName: "Student" }) },
  { id: "membership-rejected", group: "membership", name: "applicationRejected",
    build: (ctx) => templates.membership.applicationRejected(ctx, { name: "Ammu", planName: "Student",
      reason: "The enrolment date on the card had passed." }) },
  { id: "membership-active", group: "membership", name: "membershipActive",
    build: (ctx) => templates.membership.membershipActive(ctx, { name: "Ammu", planName: "Family",
      startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), features: [] }) },
  { id: "membership-expiring", group: "membership", name: "membershipExpiring",
    build: (ctx) => templates.membership.membershipExpiring(ctx, { name: "Ammu", planName: "Family",
      endDate: new Date("2026-08-23"), daysLeft: 7, amount: 45 }) },
  { id: "membership-expired", group: "membership", name: "membershipExpired",
    build: (ctx) => templates.membership.membershipExpired(ctx, { name: "Ammu", planName: "Family",
      endDate: new Date("2026-08-01") }) },
  { id: "membership-renewed", group: "membership", name: "membershipRenewed",
    build: (ctx) => templates.membership.membershipRenewed(ctx, { name: "Ammu", planName: "Family",
      startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31") }) },
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run tests/email.test.ts && npm run email:preview`
Expected: 31 fixtures pass; 13 keys remain.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates/membership.ts scripts/email-fixtures.ts
git commit -m "Convert membership lifecycle emails to the new shell"
```

---

### Task 7: Convert `privacy.ts` (6 templates)

Read the file-level comment before starting: these are the association's GDPR
paper trail, and the statutory references in them (Art. 12(3), Art. 17, § 147
AO, § 257 HGB) are **load-bearing legal text**. Copy them across verbatim. The
copy pass applies to subject, preview, eyebrow, title and lead only.

**Files:**
- Modify: `src/lib/email/templates/privacy.ts`
- Modify: `scripts/email-fixtures.ts`

**Interfaces:**
- Consumes: `bulletList`, `esc`, `facts`, `notice`, `paragraph`, `strong` from `../blocks`.
- Produces: six `Message`-returning templates; fixtures `privacy/*`.

- [ ] **Step 1: Swap the imports**

```ts
import type { MessageContext } from "../shell";
import { themed } from "../shell";
import type { TemplateOutput } from "../send";
import { absoluteUrl } from "../tokens";
import { bulletList, esc, facts, notice, paragraph, strong } from "../blocks";
```

- [ ] **Step 2: Replace each returned object**

```ts
// dataExportReady
  return {
    subject: "Your data export is ready",
    previewText: "A copy of everything we hold about you, ready to download.",
    eyebrow: "Data request",
    title: "Your data export is ready",
    accentWord: "ready",
    lead: `${esc(data.name)}, you asked for a copy of the personal data we hold about you under Article 15 GDPR. It is ready to download from your privacy settings.`,
    sections: [
      {
        label: "Your request",
        blocks: [
          facts(t, [
            { label: "Requested", value: esc(date(data.requestedAt)) },
            { label: "Format", value: "JSON" },
          ]),
          paragraph(
            t,
            "Your profile, memberships, event registrations, consent history and gallery contributions. It is available while you are signed in; we do not attach it to email, because email is not a safe place to put a complete copy of somebody's personal data.",
            { small: true, muted: true }
          ),
        ],
      },
    ],
    close: {
      button: { label: "Download my data", href: absoluteUrl("/profile/privacy") },
    },
  };

// deletionRequested
  return {
    subject: "We have your deletion request",
    previewText: `We will complete it by ${date(data.deadline)}.`,
    eyebrow: "Erasure request",
    title: "Your deletion request is recorded",
    accentWord: "recorded",
    lead: `${esc(data.name)}, we have received your request to erase your personal data under Article 17 GDPR.`,
    sections: [
      {
        label: "Your request",
        blocks: [
          facts(t, [
            { label: "Requested", value: esc(date(data.requestedAt)) },
            { label: "Completed by", value: esc(date(data.deadline)), emphasis: true },
          ]),
          notice(t, {
            title: "Changed your mind?",
            body: "You can withdraw this request from your privacy settings at any point before it is carried out. Afterwards it cannot be undone.",
          }),
        ],
      },
      {
        label: "What will happen",
        blocks: [
          bulletList(t, [
            `${strong(t, "Your profile is anonymised")} — name, email, address, phone, photograph and biometric data are removed.`,
            `${strong(t, "Your consent records are kept")}, without identifying you, because they are the evidence that consent was lawfully obtained.`,
            `${strong(t, "Payment and invoice records are kept for ten years.")} German tax and commercial law (§ 147 AO, § 257 HGB) requires it, and Art. 17(3)(b) GDPR permits it — so those rows survive, stripped of everything that points to you.`,
          ]),
        ],
      },
    ],
    close: {
      button: { label: "Manage my request", href: absoluteUrl("/profile/privacy") },
    },
  };

// deletionAdminNotice
  return {
    subject: `Erasure request: ${data.memberName}`,
    previewText: `Statutory deadline ${date(data.deadline)}.`,
    eyebrow: "Committee · GDPR",
    title: "An erasure request needs action",
    accentWord: "action",
    lead: `${strong(t, esc(data.memberName))} has asked for erasure. Art. 12(3) GDPR gives the association one month.`,
    sections: [
      {
        label: "Request",
        blocks: [
          facts(t, [
            { label: "Member", value: esc(data.memberName), emphasis: true },
            { label: "Email", value: esc(data.memberEmail) },
            { label: "Requested", value: esc(date(data.requestedAt)) },
            { label: "Deadline", value: esc(date(data.deadline)) },
          ]),
          notice(t, {
            title: "One month",
            body: "Art. 12(3) GDPR gives the association a month to act. Missing it is a supervisory-authority matter, not an internal one.",
          }),
          data.hasActiveMembership
            ? notice(t, {
                title: "This member has an active membership",
                body: "Confirm they understand it ends with the erasure, and keep the financial records — those are retained under § 147 AO regardless.",
              })
            : null,
        ],
      },
    ],
    close: {
      button: { label: "Open member record", href: absoluteUrl("/admin/members") },
    },
  };

// deletionCancelled
  return {
    subject: "Your deletion request was withdrawn",
    previewText: "Your account stays as it is. Nothing was removed.",
    eyebrow: "Erasure withdrawn",
    title: "Your request is withdrawn",
    accentWord: "withdrawn",
    lead: `${esc(data.name)}, you have withdrawn your erasure request. Nothing was deleted and your account continues exactly as before.`,
    sections: [
      {
        blocks: [
          paragraph(t, "You can make the request again at any time — the right does not expire."),
        ],
      },
    ],
    close: {
      button: { label: "Privacy settings", href: absoluteUrl("/profile/privacy") },
    },
  };

// deletionCompleted
  return {
    subject: "Your data has been erased",
    previewText: "Done. This is the last email you will receive from us.",
    eyebrow: "Erasure complete",
    title: "Your data has been erased",
    accentWord: "erased",
    lead: `${esc(data.name)}, your erasure request has been carried out in full on ${strong(t, esc(date(data.completedAt)))}.`,
    sections: [
      {
        label: "What was done",
        blocks: [
          bulletList(t, [
            "Your name, email address, postal address, phone number, photograph and any biometric data have been removed from our systems.",
            "Your account can no longer be signed in to.",
            "Anonymised financial records remain for ten years under § 147 AO and § 257 HGB. They no longer identify you.",
          ]),
          notice(t, {
            body: `${strong(t, "This is the last message we will send to this address.")} If you would like to be part of the association again in future you are very welcome — you would simply start with a new account.`,
          }),
        ],
      },
    ],
    close: {
      note: "Thank you for the time you spent with us.",
    },
  };

// legalUpdate
  return {
    subject: data.requiresConsent
      ? `Please review our updated ${data.documentTitle}`
      : `We have updated our ${data.documentTitle}`,
    previewText: data.changeNote || `It changes on ${date(data.effectiveFrom)}.`,
    eyebrow: "Policy update",
    title: `Our ${data.documentTitle} has changed`,
    accentWord: "changed",
    lead: `${esc(data.name)}, we have published a new version of our ${strong(t, esc(data.documentTitle))}, effective ${strong(t, esc(date(data.effectiveFrom)))}.`,
    sections: [
      {
        blocks: [
          data.changeNote
            ? notice(t, { title: "What changed", body: esc(data.changeNote) })
            : null,
          paragraph(
            t,
            data.requiresConsent
              ? "Because this change affects how we handle your personal data, we need your agreement to the new version. You will be asked the next time you sign in, and it takes a moment."
              : "No action is needed — we are telling you because you have a right to know when these terms change."
          ),
        ],
      },
    ],
    close: {
      button: data.requiresConsent
        ? { label: "Review and agree", href: absoluteUrl("/profile/privacy") }
        : { label: "Read the new version", href: absoluteUrl("/legal/privacy") },
    },
  };
```

- [ ] **Step 3: Add the fixtures**

```ts
  { id: "privacy-export", group: "privacy", name: "dataExportReady",
    build: (ctx) => templates.privacy.dataExportReady(ctx, { name: "Ammu", requestedAt: new Date("2026-08-10") }) },
  { id: "privacy-deletion-requested", group: "privacy", name: "deletionRequested",
    build: (ctx) => templates.privacy.deletionRequested(ctx, { name: "Ammu",
      requestedAt: new Date("2026-08-10"), deadline: new Date("2026-09-10") }) },
  { id: "privacy-deletion-admin", group: "privacy", name: "deletionAdminNotice",
    build: (ctx) => templates.privacy.deletionAdminNotice(ctx, { memberName: "Ammu",
      memberEmail: "ammu@example.org", requestedAt: new Date("2026-08-10"),
      deadline: new Date("2026-09-10"), hasActiveMembership: true }) },
  { id: "privacy-deletion-cancelled", group: "privacy", name: "deletionCancelled",
    build: (ctx) => templates.privacy.deletionCancelled(ctx, { name: "Ammu" }) },
  { id: "privacy-deletion-completed", group: "privacy", name: "deletionCompleted",
    build: (ctx) => templates.privacy.deletionCompleted(ctx, { name: "Ammu", completedAt: new Date("2026-09-01") }) },
  { id: "privacy-legal-update", group: "privacy", name: "legalUpdate",
    build: (ctx) => templates.privacy.legalUpdate(ctx, { name: "Ammu", documentTitle: "Privacy Policy",
      changeNote: "We now name our email provider.", requiresConsent: true,
      effectiveFrom: new Date("2026-09-01") }) },
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run tests/email.test.ts && npm run email:preview`
Expected: 37 fixtures pass; 7 keys remain. Read the rendered `deletionRequested`
and `deletionCompleted` in the gallery and confirm every statutory reference
survived the move.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates/privacy.ts scripts/email-fixtures.ts
git commit -m "Convert GDPR correspondence to the new shell"
```

---

### Task 8: Convert `gallery.ts`, `contact.ts` and `staff.ts` (7 templates)

The three small files, converted together — each is two or three templates and
none introduces a block the earlier tasks have not already used.

**Files:**
- Modify: `src/lib/email/templates/gallery.ts`
- Modify: `src/lib/email/templates/contact.ts`
- Modify: `src/lib/email/templates/staff.ts`
- Modify: `scripts/email-fixtures.ts`

**Interfaces:**
- Consumes: `esc`, `facts`, `notice`, `paragraph`, `quote`, `strong` from `../blocks`.
- Produces: seven `Message`-returning templates; fixtures `gallery/*`, `contact/*`, `staff/*`.

- [ ] **Step 1: Swap the imports in all three files**

```ts
// gallery.ts
import { esc, facts, paragraph, quote, strong } from "../blocks";
// contact.ts
import { esc, facts, paragraph, quote, strong } from "../blocks";
// staff.ts
import { esc, facts, notice, paragraph } from "../blocks";
```

Each also swaps `../layout` for `../shell` as in every prior task.

- [ ] **Step 2: Replace each returned object**

```ts
// gallery.ts — contributionAdminNotice
  return {
    subject: `New photographs for ${data.albumTitle}`,
    previewText: `${data.uploaderName} contributed and it needs review.`,
    eyebrow: "Committee",
    title: "A contribution is waiting",
    accentWord: "waiting",
    lead: `${strong(t, esc(data.uploaderName))} has added photographs to ${esc(data.albumTitle)}.`,
    sections: [
      {
        label: "Submission",
        blocks: [
          facts(t, [
            { label: "From", value: esc(data.uploaderName), emphasis: true },
            { label: "Album", value: esc(data.albumTitle) },
            data.count ? { label: "Items", value: String(data.count) } : null,
          ]),
        ],
      },
    ],
    close: {
      button: { label: "Review the contribution", href: absoluteUrl("/admin/gallery/contributions") },
      note: "Nothing is public until you approve it.",
    },
  };

// gallery.ts — contributionApproved
  return {
    subject: `Your photographs are live — ${data.albumTitle}`,
    previewText: "Approved and published to the gallery. Thank you for sharing.",
    eyebrow: "Published",
    title: "Your photographs are published",
    accentWord: "published",
    lead: `${esc(data.name)}, what you shared for ${strong(t, esc(data.albumTitle))} is approved and now visible to the whole community.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            "Thank you for adding your view of the day. The albums are much better for having more than one camera in them."
          ),
        ],
      },
    ],
    close: {
      button: { label: "See it in the gallery", href: absoluteUrl("/gallery") },
    },
  };

// gallery.ts — contributionRejected
  return {
    subject: `About your contribution to ${data.albumTitle}`,
    previewText: "We were not able to publish this one.",
    eyebrow: "Contribution update",
    title: "We could not publish this one",
    accentWord: "publish",
    lead: `${esc(data.name)}, thank you for submitting to ${strong(t, esc(data.albumTitle))}. We were not able to include it in the album.`,
    sections: [
      {
        blocks: [
          data.reason ? quote(t, data.reason) : null,
          paragraph(
            t,
            "This is usually about image quality or someone in the frame who has not consented to being photographed — rarely about the picture itself. Please do keep contributing."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Share something else", href: absoluteUrl("/gallery") },
    },
  };

// contact.ts — contactAdminNotice
  return {
    subject: `Contact form: ${data.subject}`,
    previewText: `${data.name} wrote: ${data.message.slice(0, 120)}`,
    eyebrow: "Enquiry",
    title: "New message from the website",
    accentWord: "message",
    lead: `${strong(t, esc(data.name))} wrote in about ${esc(data.subject)}.`,
    sections: [
      {
        label: "Sender",
        blocks: [
          facts(t, [
            { label: "Name", value: esc(data.name), emphasis: true },
            { label: "Email", value: esc(data.email) },
            { label: "Subject", value: esc(data.subject) },
          ]),
        ],
      },
      { label: "Their message", blocks: [quote(t, data.message)] },
    ],
    close: {
      button: { label: `Reply to ${esc(data.name)}`, href: `mailto:${data.email}` },
      note: "The sender has been sent an automatic acknowledgement.",
    },
  };

// contact.ts — contactAcknowledgement
  return {
    subject: "We got your message",
    previewText: "Someone will come back to you within a day or two.",
    eyebrow: "Message received",
    title: `Namaskaram, ${data.name}`,
    accentWord: data.name,
    lead: `Thank you for writing to us about ${strong(t, esc(data.subject))}. Your message has reached the committee.`,
    sections: [
      {
        blocks: [
          paragraph(
            t,
            "We are a volunteer association, so replies come from people fitting this around their jobs — usually within one or two working days."
          ),
          paragraph(
            t,
            "There is no need to write again in the meantime; this is not an automated queue, and a second message will not make it move faster."
          ),
        ],
      },
    ],
    close: {
      button: { label: "Back to the website", href: absoluteUrl("/") },
    },
  };

// staff.ts — invite
  return {
    subject: `You've been invited to help run ${ctx.siteName}`,
    previewText: `Set up your ${data.roleName} access. The link expires in ${data.expiresHours} hours.`,
    eyebrow: "Invitation",
    title: "Set up your access",
    accentWord: "access",
    lead: `${esc(data.invitedByName)} has invited you to help run ${esc(ctx.siteName)} as ${esc(data.roleName)}. Choose a password to get started.`,
    sections: [
      {
        label: "Your invitation",
        blocks: [
          facts(t, [
            { label: "Role", value: esc(data.roleName) },
            { label: "Invited by", value: esc(data.invitedByName) },
          ]),
          data.hasExistingAccount
            ? notice(t, {
                title: "You already have an account",
                body: `The password you set here replaces your current one, and works for both ${esc(ctx.siteName)} and the admin area.`,
              })
            : paragraph(t, "You'll be asked to choose a password, then sign in with it."),
        ],
      },
    ],
    close: {
      button: { label: "Set up your access", href: data.inviteLink },
      note: `The link expires in ${data.expiresHours} hours and can be used once. If you weren't expecting this, ignore it — nothing happens until you use the link.`,
    },
  };

// staff.ts — accessChanged
  const revoked = data.roleName === null;
  return {
    subject: revoked
      ? "Your admin access has been removed"
      : `Your role is now ${data.roleName}`,
    previewText: revoked
      ? "Your administrator access has been removed."
      : `You are now ${data.roleName}.`,
    eyebrow: "Security",
    title: revoked ? "Admin access removed" : "Your role has changed",
    accentWord: revoked ? "removed" : "changed",
    lead: revoked
      ? `${esc(data.changedByName)} has removed your administrator access. Your membership account is unaffected.`
      : `${esc(data.changedByName)} has changed your role to ${esc(data.roleName)}.`,
    sections: [
      {
        blocks: [
          notice(t, {
            title: "Didn't expect this?",
            body: "Reply to this email and tell the committee.",
          }),
        ],
      },
    ],
    close: {
      note: "You are receiving this because it affects your account's access.",
    },
  };
```

- [ ] **Step 3: Add the fixtures**

```ts
  { id: "gallery-admin-notice", group: "gallery", name: "contributionAdminNotice",
    build: (ctx) => templates.gallery.contributionAdminNotice(ctx, { uploaderName: "Ammu",
      albumTitle: "Onam 2026", count: 12 }) },
  { id: "gallery-approved", group: "gallery", name: "contributionApproved",
    build: (ctx) => templates.gallery.contributionApproved(ctx, { name: "Ammu", albumTitle: "Onam 2026" }) },
  { id: "gallery-rejected", group: "gallery", name: "contributionRejected",
    build: (ctx) => templates.gallery.contributionRejected(ctx, { name: "Ammu", albumTitle: "Onam 2026",
      reason: "Two of the images are out of focus." }) },
  { id: "contact-admin-notice", group: "contact", name: "contactAdminNotice",
    build: (ctx) => templates.contact.contactAdminNotice(ctx, { name: "Ammu",
      email: "ammu@example.org", subject: "Malayalam classes",
      message: "Hello,\n\nAre the weekend classes open to beginners?\n\nThank you." }) },
  { id: "contact-ack", group: "contact", name: "contactAcknowledgement",
    build: (ctx) => templates.contact.contactAcknowledgement(ctx, { name: "Ammu", subject: "Malayalam classes" }) },
  { id: "staff-invite", group: "staff", name: "invite",
    build: (ctx) => templates.staff.invite(ctx, { inviteLink: "https://keralasamajam.de/invite?t=abc",
      roleName: "Editor", invitedByName: "Priya", expiresHours: 48, hasExistingAccount: false }) },
  { id: "staff-access-changed", group: "staff", name: "accessChanged",
    build: (ctx) => templates.staff.accessChanged(ctx, { name: "Ammu", roleName: null, changedByName: "Priya" }) },
```

- [ ] **Step 4: Verify — the coverage test should now pass**

Run: `npx tsc --noEmit && npx vitest run tests/email.test.ts && npm run email:preview`
Expected: **all 44 fixtures present and green.** The `has a fixture` test passes
for the first time. Open the gallery and read all 44 end to end.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates/gallery.ts src/lib/email/templates/contact.ts \
        src/lib/email/templates/staff.ts scripts/email-fixtures.ts
git commit -m "Convert gallery, contact and staff emails to the new shell"
```

---

### Task 9: Collapse the union and delete the old shell

Nothing returns an `EmailDocument` any more, so the bridge and both old files go.

**Files:**
- Modify: `src/lib/email/send.ts`
- Modify: `src/lib/email/index.ts`
- Delete: `src/lib/email/layout.ts`
- Delete: `src/lib/email/components.ts`
- Delete: `tests/email-bridge.test.ts`

**Interfaces:**
- Consumes: all 44 converted templates from Tasks 3–8.
- Produces: `TemplateOutput = Message`; `renderFor` removed; `renderMessage` is the only renderer.

- [ ] **Step 1: Prove nothing still imports the old modules**

Run:
```bash
grep -rn "from \"\.\./layout\"\|from \"\./layout\"\|from \"\.\./components\"\|from \"\./components\"" src/lib/email/ src/
```
Expected: no matches. If any appear, that template was missed — convert it
before continuing.

- [ ] **Step 2: Collapse the type**

In `src/lib/email/send.ts`:

```ts
import type { Message, MessageContext } from "./shell";
import { renderMessage } from "./shell";

/** What a template returns. */
export type TemplateOutput = Message;
export type EmailContext = MessageContext;
```

Delete `isMessage` and `renderFor`, and change the render call back to
`renderMessage(ctx, built)`.

- [ ] **Step 3: Delete the old shell and its tests**

```bash
git rm src/lib/email/layout.ts src/lib/email/components.ts tests/email-bridge.test.ts
```

`blocks.ts` currently imports `esc` and `escUrl` from `components.ts` — move
those two functions into `blocks.ts` and delete the re-export at the bottom of
the file.

- [ ] **Step 4: Update the barrel**

In `src/lib/email/index.ts`, remove `renderEmail`, `renderFor` and the
`EmailDocument` type export; keep `renderMessage`, `Message`, `MessageContext`.
Update the file-level comment, which still describes the old arrangement.

- [ ] **Step 5: Update the test to drop the union branch**

In `tests/email.test.ts`, remove `isMessage` and un-nest the three
`Message`-only assertions so they run for every fixture.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm test && npm run email:preview && npm run build`
Expected: all green, including a full Next build — this is the first step where
a missed import would break the app rather than just the gallery.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/email tests scripts
git commit -m "Retire the old email shell now that every template has moved"
```

---

## Self-Review

**Spec coverage.** §5.1 tokens, §5.2 blocks and §5.3 shell are already
implemented and visually approved — this plan changes only `Message.sections`
(Task 1). §6 message model → Task 1. §7 copy rules → Global Constraints, applied
in Tasks 3–8. §8 inventory: all 8 files and 44 templates are assigned — payments
6, account 6, events 10, membership 9, privacy 6, gallery 3, contact 2, staff 2
= 44. §9 review harness → Task 2. §10 testing: tests 1–7 are in Task 2's suite;
test 8 (light-only) is there too. §11 file inventory → Tasks 1, 2, 9. §12 risks:
the copy-pass risk is addressed by the "never invent facts" constraint and by
Task 7's verbatim-statutory-text instruction; the `send.ts` switch-point risk by
Task 1's union; the data-URI risk by the flat fallback already in `shell.ts`;
the sample-data risk by fixtures covering the optional-field branches each
template actually takes.

**Placeholder scan.** No TBD/TODO. Every conversion shows the literal object.
Task 8 groups three files but repeats the code for all seven templates rather
than saying "similar to".

**Type consistency.** `TemplateOutput` is the union from Task 1 and `Message`
from Task 9. `Fixture.build` returns `TemplateOutput` throughout. `MessageContext`
replaces `EmailContext` in every converted template, and Task 9 re-aliases
`EmailContext = MessageContext` so external callers of `getEmailContext` keep
compiling. `EventSummary extends EventFacts` (Task 5) matches the `EventFacts`
interface exported by `blocks.ts`. `notice()` and `amount()` take no `tone` —
every call site above omits it.

**One gap found and closed:** `blocks.ts` re-exports `esc`/`escUrl` from
`components.ts`, which Task 9 deletes. Task 9 Step 3 now moves those two
functions rather than leaving a dangling import.
