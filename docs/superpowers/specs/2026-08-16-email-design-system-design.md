# Email Design System — Design

Date: 2026-08-16
Status: Approved for planning

## 1. Problem

The 44 transactional emails do not look like the site that sends them.

The home page speaks one language: a pill eyebrow with a brand dot, a Manrope
extrabold headline carrying a single accent word, rounded bordered panels on
faintly tinted surfaces, hairline-ruled facts rather than boxed cells, and a
dark closing band. The emails speak another: a bare tracked label, a flat
headline, a column of tinted cards with no relation to any surface on the site,
and a pale grey footer.

Three concrete defects sit underneath the stylistic gap.

**Every email at `HEAD` ships without its button.** `action()` is defined in
[layout.ts](../../../src/lib/email/layout.ts) but never called from
`renderEmail`, so the ticket has no "View event details" and the password reset
has no reset button. A one-line fix exists uncommitted in the working tree.

**Dark mode renders an invisible message.** The `prefers-color-scheme` block
repaints backgrounds dark while every text colour stays inlined at its light
value, producing `#1a1a1a` ink on a `#1a1a1f` card. Completing the palette
would not fix it: Gmail drops `<style>` on forward, so a share of recipients
would still get the half-inverted state.

**The smallest type was the least legible.** `muted` at `#8a8a8a` clears only
3.5:1 on white, and it sets every section label and every fact label.

## 2. Goals

- An email and the page it links to are recognisably the same product.
- One voice across all 44 messages — subject, preview, eyebrow, headline, lead
  and closing note written to one set of rules rather than 44 times over.
- A template cannot drift out of the design system, because it never chooses a
  colour, a surface or a padding.
- The whole set can be reviewed at once, before it reaches a member.
- The palette follows `config.branding.primaryColor`, so re-branding the site
  re-brands the mail with no code change.

## 3. Non-goals

Each can be added later without rework.

- Dark mode. The site is light-only (§4, D3).
- A plain-text alternative part per message.
- Translations. The site is English-only outside the legal documents.
- Per-recipient content beyond what the templates already interpolate.
- Replacing the transport, the logging or the preference gating in
  [send.ts](../../../src/lib/email/send.ts).

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | The message body is an ordered `sections` array; the shell assigns each section's surface from its **position** | The home page's D4 — surfaces computed, never stored. A template cannot pick a colour, so two identical adjacent surfaces are impossible by construction. |
| D2 | No block paints its own background | The shell decides a section's fill *after* the template has built its blocks, so a block cannot know what it is sitting on. `primaryTint` (6%) is also darker than `bandB` (5%), so a tinted block on a tinted panel would vanish. |
| D3 | Light only, declared | The site has no theme switcher and never applies `.dark`. A hand-rolled dark palette cannot be made reliable when `<style>` is dropped on forward; declaring light-only lets force-inverting clients run their own inversion, which flips text and background together. |
| D4 | Band tints derived from the brand colour, not copied from `globals.css` | `--surface-2` and `--surface-3` are hardcoded and tuned to the rose default. At the configured green they would put pink panels beside green buttons. |
| D5 | The accent word is a colour, not a second typeface | The site sets it in Newsreader italic. In email that costs a second font request and falls back to Georgia wherever `<link>` is stripped — a different voice, not a smaller one. |
| D6 | Sections are inset rounded panels, not full-bleed bands | Matches what the site actually draws: `rounded-[1.5rem] border border-border` on the About collage, `rounded-2xl border border-border bg-surface-1` on event cards. |
| D7 | The dark treatment — black, glow, dot grid — belongs to the footer alone | Putting the call to action on the glow placed the one element the reader must click on top of the busiest background in the message. |
| D8 | The glow and dot grid ship as one SVG data URI | Email has no `filter: blur()` and Outlook ignores CSS gradients; SVG has a real `radialGradient`. One image rather than two stacked `background-image` layers, which are unevenly supported. |
| D9 | `MAX_SECTIONS = 2`, checked in tests and not enforced at render time | Three panels plus a hero plus a footer is a page. Throwing during a send over a layout opinion is a worse failure than a long email. |
| D10 | The new system ships as new files beside the old, and the 44 templates migrate onto it | Lets the design be reviewed against real HTML while every live send path stays untouched and compiling. |
| D11 | Review is a script rendering to disk, not an admin page | No new permission, no sidebar entry, no page guard landing in the middle of the in-flight RBAC migration. Renders the exact HTML that ships. |

## 5. The design system

Three files, all additive to the existing module.

### 5.1 Tokens — `tokens.ts`

Extends `EmailTheme`; nothing existing is removed.

**Bands.** Derived exactly as `primaryTint` is:

```
bandA = mix(brand, white, 0.975)   // 2.5% brand
bandB = mix(brand, white, 0.95)    // 5%   brand
```

Both are deliberately fainter than `primaryTint` (6%), which is what forces D2.
At the default rose they land on `#fef9fa` and `#fef4f6` against the site's
`#fcf8f9` blush — imperceptibly different, and self-consistent at any brand
colour.

**The warm neutral ramp.** The site's surfaces are warm (`--surface-2` is a
cream at hue 32), so pure grey read cold on them.

| | Was | Now |
|---|---|---|
| `ink` | `#1a1a1a` | `#1c1a19` |
| `body` | `#525252` | `#55504c` |
| `muted` | `#8a8a8a` | `#78716c` — 3.5:1 → **4.8:1** |
| `hairline` | `#ececec` | `#eae7e4` |
| `canvas` | `#f6f6f7` | `#f4f2f0` |
| `surfaceAlt` | `#fafafa` | `#faf8f7` |

`muted` is the one that mattered beyond taste: it sets every 11px section label
and fact label, so the smallest type in the message was also the least legible.

**The dark palette**, taken from the home page's closing band, which expresses
everything as white at an alpha. Mail clients composite 8-digit hex unreliably
and Outlook not at all, so each is precomputed flat over `#0f0f0f`:

| Token | Value | Source |
|---|---|---|
| `deep` | `#0f0f0f` | `--surface-deep` |
| `deepInk` | `#ffffff` | `text-white` |
| `deepBody` | `#9f9f9f` | `text-white/60` |
| `deepMuted` | `#6f6f6f` | white/40 |
| `deepHairline` | `#262626` | — |
| `deepEdge` | `#333333` | `border-white/15` |

### 5.2 Blocks — `blocks.ts`

The rule shaping all of it: **nothing fills itself.** Bands supply containers;
hairlines divide what is inside them.

| Old (`components.ts`) | New | Change |
|---|---|---|
| `dataCard` | `facts` | Hairline label/value rows, no box. The card title becomes the section's label, owned by the shell. |
| `amountCard` | `amount` | Centred tabular figure, extrabold, `-0.04em`, rules above and below. |
| `codeBlock` | `code` | 32px mono at `0.26em`, rules above and below. |
| `steps` | `steps` | Mono `01` `02` numerals at 10px/0.2em, matching the pillar index. The filled brand circle appears nowhere on the site. |
| `notice` | `notice` | Keeps the 3px brand bar, loses the fill. |
| `eventCard` | `eventFacts` | Returns blocks, not a card; the title goes in the section label. |
| `statusPill` | `statusPill` | Unfilled, bordered — consistent with the eyebrow pill. |
| `eyebrow` | `pill` | The site's rounded-full border with a 6px brand dot at 10px/0.22em. |
| — | `headline` | Title with one accent word in `primaryDeep`. |
| `button` | `button` | `border-radius: 999px` / `arcsize="50%"`, matching the site's `rounded-full`. |
| `quote`, `bulletList`, `paragraph`, `strong`, `link`, `note`, `stack` | unchanged | Already unboxed. |
| `Tone` / `toneColors` | narrowed | With no fills left, the five-name enum collapses to a `Surface` of `light` or `deep`. |

Every block takes an optional `Surface` and resolves its colours through
`inkFor(t, surface)`, so one implementation renders on light panels and on the
dark footer. On `deep`, `accent` is the flat brand colour rather than
`primaryDeep`, which is darkened for contrast on white and unreadable on black.

**Outlook constraints carried over unchanged:** tables not divs, inline styles
not classes, no reliance on `border-radius`. The pill degrades in the Word
engine to a bordered rectangle with a square dot; spending VML on an eyebrow
was judged a bad trade.

### 5.3 The shell — `shell.ts`

```
┌────────────────────────────────┐
│ ▬▬▬▬▬ brand bar, 4px           │
│           [logo]               │  masthead      white
│      KERALA SAMAJAM            │
├────────────────────────────────┤
│      ( • EVENT TICKET )        │  pill
│      You're on the LIST        │  hero          white
│      Ammu, your place is held  │
│   ┌────────────────────────┐   │
│   │ ONAM CELEBRATION 2026  │   │  section 0     band A
│   │ Date ────  12 Sep 2026 │   │  inset panel
│   └────────────────────────┘   │
│   ┌────────────────────────┐   │
│   │ AT THE DOOR            │   │  section 1     white
│   │        €36.00          │   │  inset panel
│   └────────────────────────┘   │
├────────────────────────────────┤
│      ( • SEE YOU THERE )       │
│   [ View event details ]       │  call to action white
│   Need to change? Reply.       │
├────────────────────────────────┤
│   Kerala Samajam AUGSBURG      │
│   Events · Gallery · …         │  footer        #0f0f0f
│   Impressum · Datenschutz      │  + glow + dots
└────────────────────────────────┘
```

**Surface rotation.** `bandFor(t, index)`: odd indices take the base surface;
even indices take a tint, and the tints cycle A, B, A, B. The rotation starts
on a tint because the hero already holds the base surface — the one difference
from the home page, where a black hero provides the break. Base-then-tint
rather than `n % 3`, so two identical adjacent panels are impossible at any
length.

**Panels.** Inset `20px` from the card edge with a `10px` gap above and below
(so `20px` between panels), `16px` radius, hairline border, `26 × 24px` inside.
Text column: `600 − 2 × (20 + 24 + 1) = 510px`. Full-width rows use the `40px`
gutter to land on the same measure. Mobile drops the inset to `14px` and panel
padding to `18px` — with two levels of padding stacked, desktop values squeeze
the column badly on a phone.

**The footer backdrop.** One SVG, built from `t.primary` at render time:

| Home page | SVG |
|---|---|
| `bg-primary/15 blur-[120px]`, 720×420 on the top edge | `radialGradient` `cx=300 cy=0 r=370`, `gradientTransform="matrix(1,0,0,0.57,0,0)"`, stops `0.16 → 0.07 → 0.015 → 0` |
| `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09))` @28px, wrapped in `opacity-[0.35]` | `<pattern>` at 28px, `fill-opacity="0.032"` — the 0.09 **×** the wrapper |
| `maskImage: radial-gradient(ellipse 70% 60% …)` | `<mask>` with a matching radial falloff |

The backdrop is `320px` tall, matching the footer. This matters: the dot mask
is centred at 50% of the SVG, so a backdrop much taller than the cell puts the
texture's centre below the visible area and the whole thing renders uniformly
faded.

Progressive enhancement throughout — a client that drops data URIs falls back
to the flat `background-color` declared beside it.

**The footer is one cell.** The glow is a single no-repeat image anchored to
the top of what it paints, so splitting the footer across rows draws it twice.
It carries the site footer's one piece of identity styling: the last word of
the site name in the brand colour ([footer.tsx:43](../../../src/components/layout/footer.tsx#L43)).

## 6. The message model

```ts
interface Message {
  subject: string;
  previewText: string;
  eyebrow: string;
  title: string;
  accentWord?: string;      // must occur in `title` verbatim
  lead?: string;            // HTML — escape at the call site
  sections?: MessageSection[];
  close?: MessageClose;
}

interface MessageSection {
  label?: string;
  blocks: (string | null | undefined | false)[];
}

interface MessageClose {
  eyebrow?: string;
  title?: string;           // see below
  accentWord?: string;
  lead?: string;            // see below
  button?: { label: string; href: string };
  note?: string;
}
```

`MessageClose.title` and `lead` exist but stay empty on almost every message. A
transactional email has already said what happened by the time the reader
reaches the bottom; a second headline there is home-page CTA copy pasted into a
receipt, and it was most of why the first draft scrolled. Use them only where
the closing genuinely changes the subject — a renewal notice inviting someone
to rejoin.

`accentWord` follows the About page's rule exactly: it must appear inside
`title` verbatim, and falls back to plain text when blank or not found.

## 7. Copy rules

One voice, six fields, applied to all 44.

- **Subject** — what happened and to what. Sentence case, no `Your …` padding.
  Under 55 characters where the content allows, so nothing truncates on a phone.
- **Preview** — continues the subject; never repeats it.
- **Eyebrow** — one to three words, the category.
- **Title** — three to seven words, containing exactly one accent word: the
  word carrying the news (`confirmed`, `received`, `changed`), never a filler.
- **Lead** — one or two sentences. Name the recipient, state the fact.
- **Note** — what to do if this is wrong, and how to reach a person.

```
ticket    subject  "You're in — Onam 2026, 12 September"
          preview  "Your place is held. The ticket PDF is attached."
          eyebrow  "Event ticket"
          title    "You're on the list"        accent → "list"
          lead     "Ammu, your place at Onam Celebration 2026 is confirmed."
          note     "Need to change or cancel? Just reply to this email."
```

**Scope boundary.** Rewrites restate what the template already claims. Where
current copy asserts something that cannot be verified from the code — a
monitored reply address, a refund window — it is flagged for a decision rather
than replaced with an invention.

## 8. Template inventory

44 templates across 8 files, all converting from `EmailDocument` to `Message`.

| File | Count | Templates |
|---|---|---|
| `account.ts` | 6 | `verifyEmail`, `welcome`, `otpCode`, `passwordReset`, `passwordChanged`, `emailChanged` |
| `events.ts` | 10 | `ticket`, `registrationCancelled`, `registrationRemovedByAdmin`, `registrationCancelledAdminNotice`, `eventCancelled`, `eventRescheduled`, `eventReminder`, `eventThankYou`, `eventAnnouncement`, `eventFull` |
| `membership.ts` | 9 | `studentApplicationReceived`, `applicationReceived`, `applicationAdminNotice`, `studentVerified`, `applicationRejected`, `membershipActive`, `membershipExpiring`, `membershipExpired`, `membershipRenewed` |
| `payments.ts` | 6 | `membershipPaymentRequest`, `membershipPaymentReceived`, `eventPaymentRecorded`, `eventPaymentReverted`, `paymentOverdue`, `adminPaymentDigest` |
| `privacy.ts` | 6 | `dataExportReady`, `deletionRequested`, `deletionAdminNotice`, `deletionCancelled`, `deletionCompleted`, `legalUpdate` |
| `gallery.ts` | 3 | `contributionAdminNotice`, `contributionApproved`, `contributionRejected` |
| `contact.ts` | 2 | `contactAdminNotice`, `contactAcknowledgement` |
| `staff.ts` | 2 | `invite`, `accessChanged` |

Three are already converted in the preview harness as prototypes — `ticket`,
`membershipPaymentReceived`, `otpCode` — chosen as the most complex, the one
with money, and the sparsest.

`staff.ts` arrived after this work started (commit `b7c42fb`) and is wired into
`templates` in [index.ts](../../../src/lib/email/index.ts). It is called out
because an initial survey of the module missed it, and a conversion plan that
counts seven files silently leaves two templates on a deleted shell.

`adminPaymentDigest` is the shape most likely to resist `MAX_SECTIONS`; it is
scheduled first in the plan so the constraint is tested against its worst case
before 43 other conversions depend on it.

## 9. Review harness

`npm run email:preview` → `tsx scripts/email-preview.ts`, already in place.

Renders every message with realistic sample data into a gitignored
`.email-preview/`, one file each plus an index that stacks them all in iframes.
Templates are pure `(ctx, data) => Message`, so a fabricated `MessageContext`
is all they need — no database, no dev server, no login. The HTML is what the
transport would send.

`PREVIEW_BRAND=#14801a` re-renders the whole set at another brand colour, which
is how D4 is checked by eye rather than by argument.

## 10. Testing

`tests/email.test.ts`, pure, no database. Vitest already runs `tests/**/*.test.ts`
in a node environment.

1. All 44 render without throwing on sample data. The test enumerates
   `templates` at runtime rather than a hand-written list, so a template file
   added later cannot quietly escape the suite the way `staff.ts` escaped the
   initial survey.
2. **No stray hex.** Every colour in the rendered output is in the derived set
   (brand, `primaryDeep`, `bandA`, `bandB`) or the neutral list. This makes the
   "grep the rendered output, do not trust the source" rule automatic.
3. Surface rotation: no two adjacent panels share a fill, at any section count.
4. Every template supplies subject, preview, eyebrow and title, and its
   `accentWord` — where present — occurs in `title` verbatim.
5. No template exceeds `MAX_SECTIONS`.
6. `<script>` in a member's name emits escaped text.
7. Transactional templates never carry an unsubscribe link.
8. The rendered document declares `color-scheme: light` and contains no
   `prefers-color-scheme` rule.

## 11. File inventory

Already written (prototype, in the working tree):

- `src/lib/email/blocks.ts`
- `src/lib/email/shell.ts`
- `src/lib/email/tokens.ts` — band, warm ramp and dark tokens (edit)
- `scripts/email-preview.ts`
- `package.json`, `.gitignore` (edit)

To do:

- `src/lib/email/templates/*.ts` — 44 conversions across 8 files
- `src/lib/email/index.ts` — export `renderMessage`, retire `renderEmail`
- `src/lib/email/send.ts` — `TemplateOutput = Message`
- `tests/email.test.ts`
- Delete `src/lib/email/layout.ts` and `src/lib/email/components.ts` once no
  template imports them

Separately and immediately: commit the `action(t, doc)` line, so `HEAD` stops
sending buttonless emails before any of this lands.

## 12. Risks

**The copy pass is where a factual error enters.** 44 messages rewritten by
hand is 44 chances to promise something the association does not do. Mitigation:
rewrites restate existing claims only, and anything unverifiable is flagged
rather than replaced (§7).

**`send.ts` is a single switch point.** `TemplateOutput` is an alias for
`EmailDocument`; changing it to `Message` breaks all 44 at once. Mitigation:
both shells coexist until the last template converts, so the alias changes only
when nothing depends on the old one.

**The dot grid and glow are data URIs.** Some corporate filters strip them.
Mitigation: both sit on a flat `background-color` of the band's own colour, so
the fallback is the design without its texture, not a broken footer.

**Sample data drift.** The preview renders what the harness invents, not what
production sends. A template can look right in the gallery and break on a null
`endDate`. Mitigation: sample data covers the optional-field cases each
template actually branches on, and test 1 runs the same fixtures.
