# Launch Ceremony — Design

**Date:** 2026-09-04
**Route:** `/launch` (noindex, force-dynamic)
**Status:** approved for planning

## Purpose

A one-shot, projector-driven inauguration for the Kerala Samajam Augsburg
website. A host arms the stage, a chief guest presses one button, a counter
runs, a curtain parts, confetti fires, and the hall is left looking at a QR
code that takes them to the live site.

It runs once, live, in front of an audience, on hardware we do not control.
Every decision below favours rehearsability and predictable failure over
sophistication.

## What already exists

An untracked draft lives at `src/app/launch/` and `src/components/launch/`.
It has the right *purpose* — fullscreen stage, operator controls, QR panel —
and the wrong everything else:

- `launch-ceremony.tsx` (406 lines) owns state, layout, QR generation, audio
  cues, operator controls and the footer at once. No beat can be rehearsed
  without running the whole ceremony.
- The skin is amber/gold on `#070b12` with `font-black` gradient headings and
  four differently coloured feature icons. That is not the KSA brand.
- The reveal is a scissors-and-ribbon cut, not a curtain, and there is no
  counter.
- `digital-ribbon.tsx` is superseded by the curtain.
- `confetti-canvas.tsx` and `launch-audio.ts` are sound work and are kept.

`public/lamp/` (101 MB — 240 PNG frames plus mp4/webm of a nilavilakku) is
**not used by this design** and must not be committed. The hero video already
has no working deploy path for large media; a 101 MB frame sequence would
inherit that unsolved problem at ten times the size.

## Brand translation

The app is light-only, crimson-primary, and editorial. The stage is dark for
the same reason the home page hero is dark — it is a projected moment, not a
page band — but everything else conforms.

| | Draft | Becomes |
|---|---|---|
| Ground | `#070b12` navy-black | `hsl(0 0% 6%)`, the app's `--surface-deep` |
| Accent | amber `#F59E0B` | `--primary`, `hsl(346.8 77.2% 49.8%)` |
| Headline | `font-black` + gold gradient fill | Manrope extrabold, `-0.035em`, white, with exactly one Newsreader serif italic word in crimson |
| Feature icons | amber / emerald / rose / blue | all crimson, uniform weight |
| Confetti | 8 colours incl. indigo, emerald | crimson, kasavu gold, cream, white |
| Texture | none | the hero's film-grain SVG and vignette, reused verbatim |
| Layout | ad-hoc max-widths | `Container` |

Gold survives only where a Kerala ceremony earns it: the kasavu selvedge on
the curtain, and roughly a quarter of the confetti. Everywhere else it becomes
crimson.

Reused primitives: `Container`, `Eyebrow`, `SectionTitle`, `Accent`,
`SectionLead`, `Countdown`, and the hero's `EASE = [0.16, 1, 0.3, 1]`.

## Choreography

Five states, forward-only, driven by the operator. Every duration lives in one
exported table so it can be tuned during rehearsal rather than hunted through
components.

| State | What the hall sees | Duration |
|---|---|---|
| `PRESHOW` | Logo, "The unveiling begins in", `Countdown` reels ticking to ceremony time. Slow grain. Locked. | until triggered |

`PRESHOW` ends only when the operator triggers it — never on its own. The
clock is a mood-setter, not a trigger, and ceremonies start late.

That matters because `Countdown` returns `null` once its target passes. Left
alone, a ceremony running ten minutes behind would show an empty stage at the
exact moment the hall is looking at it. So `PRESHOW` swaps the reels for a
held "Beginning shortly" line when the clock reaches zero, and the stage stays
composed for as long as it needs to.

| `COUNT_IN` | Reels collapse; a huge numeral 3 → 2 → 1, each landing with a soft tick | 3 × 900 ms |
| `PARTING` | Curtain halves sweep out, gold selvedge catching light | 1600 ms |
| `CELEBRATING` | Title card — logo, "Kerala Samajam Augsburg is *live*". Confetti. Fanfare. | hold 4000 ms |
| `SHOWCASE` | Card lifts and settles into the QR + features panel | indefinite |

### Making the curtain read as fabric

Two sliding rectangles look cheap on a large projection. What sells it:

- **Irregular pleats.** Vertical gradient bands of *varying* width. Uniform
  spacing reads as a CSS gradient, which is what it is.
- **Asymmetric halves.** The two sides must not be mirror-identical; offset
  the pleat phase so the eye does not catch the symmetry.
- **Weight in the easing.** Fabric accelerates and then drags. `EASE` gives
  this; a linear or symmetric ease does not.
- **A pivot, not a slide.** A small rotation about a top-corner origin as each
  half travels, so it swings rather than translates.
- **One gold thread.** A single kasavu selvedge line at the leading edge, with
  a soft sheen that shifts as the half moves. Two or three lines read as
  tinsel.

## Components

Thin composition root, one hook for behaviour, dumb presentational scenes.

```
src/lib/ceremony-timing.ts      state union, duration table, ceremony datetime
src/lib/ceremony-machine.ts     PURE reducer — the testable core
src/components/launch/
  use-ceremony.ts               thin hook: reducer + timers + audio + keyboard
  launch-ceremony.tsx           composition root
  pre-show.tsx
  count-in.tsx
  curtain.tsx
  title-card.tsx
  showcase-panel.tsx            QR + features
  operator-bar.tsx              lock, sound test, fullscreen, re-arm, pre-flight
  confetti-canvas.tsx           kept; re-palettized to the four brand colours
  digital-ribbon.tsx            deleted
```

The reducer is a plain module rather than logic inside the hook because
`vitest.config.ts` is `environment: "node"` with `include: ["tests/**/*.test.ts"]`.
There is no jsdom, so React components cannot be unit tested without adding
test infrastructure that this feature does not justify. Keeping every
transition decision in a pure function means the part that must not fail on
the night is the part that is covered.

Keys `1`–`5` jump straight to any beat, so the curtain can be tested thirty
times without sitting through the count-in, and a stalled ceremony can be
rescued mid-flow.

## Live-event decisions

These are the details that only fail in front of an audience.

**The lock is inverted.** The draft is unlocked by default with lock as an
opt-in. That is backwards: during setup a stray spacebar fires the ceremony
with nobody watching. The stage is armed only on explicit operator unlock.

**The trigger is a large press target**, not a drag-the-rope gesture. It is
handed to a chief guest who has never seen the screen. Press, plus
Space/Enter, plus click-anywhere-when-armed. Guarded against double-fire by
the reducer.

**Audio is unlocked by an explicit gesture.** WebAudio will not produce sound
until the page has had a user interaction. If the fanfare is the first sound
and the operator never clicked anything, the ceremony is silent and nobody
finds out until it happens. The operator's unlock/test action calls an
explicit `launchAudio.unlock()`.

**Screen wake lock** is held during `PRESHOW` via `navigator.wakeLock`, so a
projector idling twenty minutes does not sleep before the moment. Failure to
acquire it is non-fatal and surfaces in the pre-flight panel.

**Reduced motion is honoured by shortening, not removing.** The curtain and
confetti are the content here, not decoration; stripping them leaves an empty
stage. Ambient parallax and grain drift are dropped.

## The QR panel

The draft calls `QRCode.toDataURL(window.location.origin)`. On the night that
projector is plausibly on a Vercel preview URL or `localhost:3000`, and the QR
silently encodes it. Two hundred people scan a dead link and there is no way
to know until it has happened. This is the highest-severity defect in the
existing code.

**Resolution:** use the existing `siteUrl()` from `src/lib/site-url.ts` — the
same helper every email link, the sitemap and the canonical metadata already
use. It returns `undefined` when the environment is unset or points at
localhost, deliberately, so callers do not advertise a dead address.

The ceremony honours that contract: **when `siteUrl()` is `undefined`, no QR
is drawn.** The panel shows an operator-facing error naming the missing
variable instead. Refusing to render is correct; guessing is not.

The resolved URL is printed in large type beneath the QR, so the operator
verifies it at a glance and anyone in the hall can type it manually.

Two specifics for projection: error-correction level **H**, so keystone
distortion and projector blur do not break the scan, and a generous quiet
zone. Rendered large enough for the back of the room.

**Features are gated by `config.features`**, the same instinct the home page
already applies through `SECTION_FEATURE`. There is no point advertising
membership on stage if the module is switched off.

Listed: Events & registration · Membership · Gallery · News & leadership.

## Pre-flight panel

Operator-only, visible in `PRESHOW`, hidden once the ceremony starts. Green or
red on each of:

- QR URL resolved (and *which* URL)
- Audio unlocked
- Fullscreen active
- Wake lock held
- Fonts loaded

For a one-shot live event this is the highest-value item in the plan. It turns
five silent failure modes into five things someone can see and fix while
there is still time.

## Configuration

The ceremony datetime lives in `ceremony-timing.ts` as a named constant with a
`NEXT_PUBLIC_CEREMONY_AT` override. Nothing is written to the database: site
content is edited through the admin CMS, and this is a one-off page, not
managed content.

The QR depends on `NEXT_PUBLIC_APP_URL` (or `SITE_URL`) being set to
`https://keralasamajam.de` in the deployment the projector will use. Note that
`ksaugsburg.de`, still hardcoded as a fallback in `legal-render.ts`, does not
resolve — that is a separate pre-existing bug and out of scope here.

## Testing

`tests/launch/` — node environment, pure logic only:

- **Reducer transitions** — every legal transition, and that illegal ones are
  refused: no trigger while locked, no double-fire, no skipping `PARTING`.
- **Timing table** — durations present, positive, and summing to the expected
  total.
- **QR URL resolution** — `undefined` env yields no QR and an error state;
  localhost yields no QR; a valid value is normalised to https without a
  trailing slash.
- **Feature gating** — a disabled module drops its card from the panel.

Component rendering, animation timing and audio are verified by rehearsal in a
browser, not by tests. That is an accepted limit, not an oversight: adding
jsdom for a page that runs once is not a trade worth making.

## Out of scope

- Anything in `public/lamp/`.
- A public or unattended variant of the page.
- Making the ceremony re-runnable across clients or persisting its state.
- Fixing the `ksaugsburg.de` fallback in `legal-render.ts`.

## Risks

| Risk | Mitigation |
|---|---|
| QR encodes a dead URL | `siteUrl()` + refuse-to-render + pre-flight check |
| Silent ceremony | Explicit audio unlock + test tone + pre-flight check |
| Accidental early trigger | Locked by default; explicit arm |
| Projector sleeps during pre-show | Wake lock + pre-flight check |
| Curtain reads as cheap CSS | Irregular pleats, asymmetry, pivot, single gold thread |
| Something stalls mid-ceremony | Keys `1`–`5` jump to any beat; re-arm resets |
| 101 MB committed by accident | `public/lamp/` explicitly excluded; verify before commit |
