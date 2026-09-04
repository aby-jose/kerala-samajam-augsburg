# Launch Ceremony Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a projector-driven inauguration page at `/launch` where a host arms the stage, a guest presses one button, a counter runs, a curtain parts, confetti fires, and the hall is left looking at a QR code to the live site.

**Architecture:** A pure reducer (`ceremony-machine.ts`) owns every transition decision and is fully unit-tested; a thin `use-ceremony` hook wraps it with timers, audio cues and keyboard handling; each beat of the ceremony is a dumb presentational component driven by props. A skeleton composition root lands early (Task 5) so every subsequent task is visually reviewable in a browser.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, framer-motion 12, `qrcode` 1.5, vitest (node environment).

**Spec:** `docs/superpowers/specs/2026-09-04-launch-ceremony-design.md`

## Global Constraints

- **Ground:** `hsl(0 0% 6%)` — the app's `--surface-deep`. Never `#070b12`.
- **Accent:** `--primary`, `hsl(346.8 77.2% 49.8%)`. Use the `text-primary` / `bg-primary` utilities, never a hardcoded amber or gold hex except where listed below.
- **Gold** is permitted in exactly two places: the curtain's kasavu selvedge, and one of the four confetti colours. Nowhere else.
- **Headlines:** Manrope extrabold, `tracking-[-0.035em]`, white, with **exactly one** Newsreader serif italic word in crimson via the `Accent` component. Never `font-black`. Never a gradient text fill.
- **Easing:** `const EASE = [0.16, 1, 0.3, 1] as const` — the same curve as the hero.
- **Confetti palette:** crimson `#E11D48`, kasavu gold `#D4A537`, cream `#F5EFE6`, white `#FFFFFF`. Exactly these four.
- **Layout:** use `Container` from `@/components/layout/container`.
- **Reuse, do not re-create:** `Container`, `Eyebrow`, `SectionTitle`, `Accent`, `SectionLead` (`@/components/layout/section-heading`), `Countdown` (`@/components/layout/countdown`), `siteUrl()` (`@/lib/site-url`), `cn` (`@/lib/utils`).
- **Never write to the database.** Site content is edited through the admin CMS; this page is a one-off, not managed content.
- **Never reference `public/lamp/`.** It is gitignored and unused.
- **Tests are node-environment only** (`vitest.config.ts`: `environment: "node"`, `include: ["tests/**/*.test.ts"]`). There is no jsdom. Only pure `.ts` logic is unit tested; components are verified by rehearsal in a browser. Do not add jsdom.
- **Test style:** `import { describe, expect, it } from "vitest";` and the `@/` alias, matching `tests/rbac/*.test.ts`.
- Run tests with `npx vitest run <path>`.

---

### Task 1: Timing table and the pure state machine

The reducer is the part that must not fail on the night, so it is a plain module with no React in it and it is written test-first.

**Files:**
- Create: `src/lib/ceremony-timing.ts`
- Create: `src/lib/ceremony-machine.ts`
- Test: `tests/launch/ceremony-machine.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type CeremonyState = "PRESHOW" | "COUNT_IN" | "PARTING" | "CELEBRATING" | "SHOWCASE"`
  - `COUNT_IN_FROM: number`, `COUNT_IN_STEP_MS: number`, `PARTING_MS: number`, `CELEBRATING_MS: number`
  - `CEREMONY_TIMING: Record<CeremonyState, number | null>`
  - `ceremonyAt(): Date | null`
  - `interface CeremonyStatus { state: CeremonyState; armed: boolean; count: number }`
  - `type CeremonyAction` — `{type:"ARM";armed:boolean} | {type:"TRIGGER"} | {type:"TICK"} | {type:"ADVANCE"} | {type:"RESET"} | {type:"JUMP";to:CeremonyState}`
  - `INITIAL_CEREMONY: CeremonyStatus`
  - `ceremonyReducer(status: CeremonyStatus, action: CeremonyAction): CeremonyStatus`

- [ ] **Step 1: Write the timing module**

Create `src/lib/ceremony-timing.ts`:

```ts
/**
 * Every duration the ceremony depends on, in one place.
 *
 * These get tuned in rehearsal, standing in the actual hall, watching the
 * actual projector. Hunting them down inside animation props is how a
 * rehearsal note turns into a half-hour of grep, so they live here instead.
 */

export type CeremonyState =
  | "PRESHOW"
  | "COUNT_IN"
  | "PARTING"
  | "CELEBRATING"
  | "SHOWCASE";

/** The count-in starts here and steps down to 1, then the curtain moves. */
export const COUNT_IN_FROM = 3;
export const COUNT_IN_STEP_MS = 900;
export const PARTING_MS = 1600;
export const CELEBRATING_MS = 4000;

/**
 * How long each state lasts before advancing on its own.
 *
 * `null` means "waits for a person": PRESHOW until the guest presses, SHOWCASE
 * forever, because the hall needs the QR on screen for as long as it takes
 * everyone to get their phone out.
 */
export const CEREMONY_TIMING: Record<CeremonyState, number | null> = {
  PRESHOW: null,
  COUNT_IN: COUNT_IN_FROM * COUNT_IN_STEP_MS,
  PARTING: PARTING_MS,
  CELEBRATING: CELEBRATING_MS,
  SHOWCASE: null,
};

/**
 * When the ceremony is scheduled, for the pre-show clock only. It never
 * triggers anything.
 *
 * Returns null when unset or unparseable rather than inventing a date, for the
 * same reason `siteUrl()` returns undefined: a confidently wrong clock on a
 * projector is worse than no clock. The pre-show holds a "Beginning shortly"
 * line instead.
 *
 * Set `NEXT_PUBLIC_CEREMONY_AT` to an ISO 8601 string with an offset, e.g.
 * "2026-09-20T18:00:00+02:00".
 */
export function ceremonyAt(): Date | null {
  const raw = (process.env.NEXT_PUBLIC_CEREMONY_AT || "").trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/launch/ceremony-machine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  INITIAL_CEREMONY,
  ceremonyReducer,
  type CeremonyStatus,
} from "@/lib/ceremony-machine";
import { CEREMONY_TIMING, COUNT_IN_FROM } from "@/lib/ceremony-timing";

const armed: CeremonyStatus = { ...INITIAL_CEREMONY, armed: true };

describe("ceremonyReducer", () => {
  it("refuses to trigger while the stage is locked", () => {
    const next = ceremonyReducer(INITIAL_CEREMONY, { type: "TRIGGER" });
    expect(next.state).toBe("PRESHOW");
  });

  it("starts the count-in when armed", () => {
    const next = ceremonyReducer(armed, { type: "TRIGGER" });
    expect(next.state).toBe("COUNT_IN");
    expect(next.count).toBe(COUNT_IN_FROM);
  });

  it("ignores a second trigger so a double press cannot restart the count", () => {
    const started = ceremonyReducer(armed, { type: "TRIGGER" });
    const ticked = ceremonyReducer(started, { type: "TICK" });
    const again = ceremonyReducer(ticked, { type: "TRIGGER" });
    expect(again).toEqual(ticked);
  });

  it("counts 3 to 1 and then parts the curtain", () => {
    let s = ceremonyReducer(armed, { type: "TRIGGER" });
    expect(s.count).toBe(3);
    s = ceremonyReducer(s, { type: "TICK" });
    expect(s.count).toBe(2);
    s = ceremonyReducer(s, { type: "TICK" });
    expect(s.count).toBe(1);
    s = ceremonyReducer(s, { type: "TICK" });
    expect(s.state).toBe("PARTING");
  });

  it("ignores ticks outside the count-in", () => {
    expect(ceremonyReducer(armed, { type: "TICK" })).toEqual(armed);
  });

  it("advances parting to celebrating to showcase", () => {
    let s: CeremonyStatus = { ...armed, state: "PARTING" };
    s = ceremonyReducer(s, { type: "ADVANCE" });
    expect(s.state).toBe("CELEBRATING");
    s = ceremonyReducer(s, { type: "ADVANCE" });
    expect(s.state).toBe("SHOWCASE");
  });

  it("stays on the showcase forever", () => {
    const s: CeremonyStatus = { ...armed, state: "SHOWCASE" };
    expect(ceremonyReducer(s, { type: "ADVANCE" })).toEqual(s);
  });

  it("re-locks the stage on reset so a rehearsal cannot leave it live", () => {
    const s: CeremonyStatus = { ...armed, state: "SHOWCASE" };
    const next = ceremonyReducer(s, { type: "RESET" });
    expect(next).toEqual(INITIAL_CEREMONY);
    expect(next.armed).toBe(false);
  });

  it("jumps straight to any beat for rehearsal", () => {
    const next = ceremonyReducer(INITIAL_CEREMONY, { type: "JUMP", to: "CELEBRATING" });
    expect(next.state).toBe("CELEBRATING");
  });

  it("gives every state a duration entry", () => {
    for (const state of ["PRESHOW", "COUNT_IN", "PARTING", "CELEBRATING", "SHOWCASE"] as const) {
      const ms = CEREMONY_TIMING[state];
      expect(ms === null || ms > 0, `${state} duration`).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/launch/ceremony-machine.test.ts`
Expected: FAIL — cannot resolve `@/lib/ceremony-machine`.

- [ ] **Step 4: Write the reducer**

Create `src/lib/ceremony-machine.ts`:

```ts
import { COUNT_IN_FROM, type CeremonyState } from "./ceremony-timing";

export interface CeremonyStatus {
  state: CeremonyState;
  /** The operator has explicitly unlocked the stage. */
  armed: boolean;
  /** The numeral currently on screen during COUNT_IN. */
  count: number;
}

export type CeremonyAction =
  | { type: "ARM"; armed: boolean }
  | { type: "TRIGGER" }
  | { type: "TICK" }
  | { type: "ADVANCE" }
  | { type: "RESET" }
  | { type: "JUMP"; to: CeremonyState };

export const INITIAL_CEREMONY: CeremonyStatus = {
  state: "PRESHOW",
  armed: false,
  count: COUNT_IN_FROM,
};

/**
 * Every transition decision the ceremony makes.
 *
 * Pure and React-free on purpose. This runs once, live, in front of a hall,
 * and `vitest` here is node-only with no jsdom — so keeping the decisions out
 * of the component is what makes the part that must not fail the part that is
 * actually covered by tests.
 *
 * Unknown transitions return the status unchanged rather than throwing. On
 * stage, a no-op is recoverable and an exception is a white screen.
 */
export function ceremonyReducer(
  status: CeremonyStatus,
  action: CeremonyAction
): CeremonyStatus {
  switch (action.type) {
    case "ARM":
      // Arming is a pre-show decision; mid-ceremony it means nothing.
      if (status.state !== "PRESHOW") return status;
      return { ...status, armed: action.armed };

    case "TRIGGER":
      // Guards both the locked stage and the double press: a guest leaning on
      // the button, or a nervous double-click, must not restart the count.
      if (status.state !== "PRESHOW" || !status.armed) return status;
      return { ...status, state: "COUNT_IN", count: COUNT_IN_FROM };

    case "TICK":
      if (status.state !== "COUNT_IN") return status;
      if (status.count <= 1) return { ...status, state: "PARTING" };
      return { ...status, count: status.count - 1 };

    case "ADVANCE":
      if (status.state === "PARTING") return { ...status, state: "CELEBRATING" };
      if (status.state === "CELEBRATING") return { ...status, state: "SHOWCASE" };
      return status;

    case "RESET":
      // Deliberately drops `armed`. Rehearsing then walking away must not
      // leave a live stage one stray spacebar from firing.
      return INITIAL_CEREMONY;

    case "JUMP":
      return { ...status, state: action.to, count: COUNT_IN_FROM };

    default:
      return status;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/launch/ceremony-machine.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ceremony-timing.ts src/lib/ceremony-machine.ts tests/launch/ceremony-machine.test.ts
git commit -m "feat: ceremony state machine and timing table"
```

---

### Task 2: QR target resolution and feature gating

The highest-severity defect in the draft page is `QRCode.toDataURL(window.location.origin)` — on the night that projector may be on a preview URL and the QR silently encodes it. This task makes the failure loud and refuses to guess.

**Files:**
- Create: `src/lib/ceremony-showcase.ts`
- Test: `tests/launch/ceremony-showcase.test.ts`

**Interfaces:**
- Consumes: `siteUrl()` from `@/lib/site-url`; `SiteConfig` from `@/lib/config-schema`.
- Produces:
  - `type QrTarget = { ok: true; url: string } | { ok: false; reason: string }`
  - `qrTarget(): QrTarget`
  - `interface CeremonyFeature { key: string; title: string; blurb: string }`
  - `ceremonyFeatures(config: SiteConfig): CeremonyFeature[]`

- [ ] **Step 1: Write the failing test**

Create `tests/launch/ceremony-showcase.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ceremonyFeatures, qrTarget } from "@/lib/ceremony-showcase";
import { defaultConfig } from "@/lib/config-schema";

const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.SITE_URL;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL;
});

describe("qrTarget", () => {
  it("refuses to produce a QR when no site URL is configured", () => {
    const target = qrTarget();
    expect(target.ok).toBe(false);
  });

  it("refuses to produce a QR pointing at localhost", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(qrTarget().ok).toBe(false);
  });

  it("names the missing variable so an operator can fix it", () => {
    const target = qrTarget();
    expect(target.ok).toBe(false);
    if (!target.ok) expect(target.reason).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("normalises a configured URL to https with no trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://keralasamajam.de/";
    const target = qrTarget();
    expect(target).toEqual({ ok: true, url: "https://keralasamajam.de" });
  });
});

describe("ceremonyFeatures", () => {
  it("lists every feature when all modules are on", () => {
    const config = {
      ...defaultConfig,
      features: {
        ...defaultConfig.features,
        enableGallery: true,
        enableMembership: true,
      },
    };
    expect(ceremonyFeatures(config).map((f) => f.key)).toEqual([
      "events",
      "membership",
      "gallery",
      "about",
    ]);
  });

  it("does not advertise membership on stage when the module is off", () => {
    const config = {
      ...defaultConfig,
      features: { ...defaultConfig.features, enableMembership: false },
    };
    expect(ceremonyFeatures(config).map((f) => f.key)).not.toContain("membership");
  });

  it("does not advertise the gallery when the module is off", () => {
    const config = {
      ...defaultConfig,
      features: { ...defaultConfig.features, enableGallery: false },
    };
    expect(ceremonyFeatures(config).map((f) => f.key)).not.toContain("gallery");
  });

  it("always keeps events and about, which have no module switch", () => {
    const config = {
      ...defaultConfig,
      features: {
        ...defaultConfig.features,
        enableGallery: false,
        enableMembership: false,
      },
    };
    expect(ceremonyFeatures(config).map((f) => f.key)).toEqual(["events", "about"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/launch/ceremony-showcase.test.ts`
Expected: FAIL — cannot resolve `@/lib/ceremony-showcase`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/ceremony-showcase.ts`:

```ts
import { siteUrl } from "./site-url";
import type { SiteConfig } from "./config-schema";

export type QrTarget =
  | { ok: true; url: string }
  | { ok: false; reason: string };

/**
 * The address the hall's phones will be sent to.
 *
 * The draft page built this from `window.location.origin`, which is the single
 * worst place to get it: on the night that projector is plausibly on a Vercel
 * preview URL or localhost:3000, the QR encodes it silently, two hundred people
 * scan a dead link, and nobody finds out until it has already happened.
 *
 * `siteUrl()` returns undefined rather than guessing when the environment is
 * unset or local, and this honours that contract by refusing to render a code
 * at all. A missing QR is an obvious problem someone fixes in the ten minutes
 * before the ceremony. A wrong QR is an invisible one.
 */
export function qrTarget(): QrTarget {
  const url = siteUrl();

  if (!url) {
    return {
      ok: false,
      reason:
        "NEXT_PUBLIC_APP_URL is unset or points at localhost, so there is no " +
        "public address to encode. Set it to https://keralasamajam.de on the " +
        "deployment this projector is opening.",
    };
  }

  return { ok: true, url };
}

export interface CeremonyFeature {
  key: string;
  title: string;
  blurb: string;
}

/** Which module switch, if any, governs a card — mirrors the home page's `SECTION_FEATURE`. */
type FeatureSwitch = "enableGallery" | "enableMembership";

const FEATURES: (CeremonyFeature & { governedBy?: FeatureSwitch })[] = [
  {
    key: "events",
    title: "Events & registration",
    blurb: "See what's coming and reserve your seat",
  },
  {
    key: "membership",
    title: "Membership",
    blurb: "Join the Kerala Samajam family",
    governedBy: "enableMembership",
  },
  {
    key: "gallery",
    title: "Gallery",
    blurb: "Relive the moments we've shared",
    governedBy: "enableGallery",
  },
  {
    key: "about",
    title: "News & leadership",
    blurb: "Meet the committee behind KSA",
  },
];

/**
 * The feature cards to show beside the QR, minus anything switched off.
 *
 * Same instinct as the home page: there is no point putting membership on a
 * projector in front of two hundred people if the module is disabled and the
 * route 404s the moment somebody scans.
 */
export function ceremonyFeatures(config: SiteConfig): CeremonyFeature[] {
  return FEATURES.filter(
    (f) => !f.governedBy || config.features[f.governedBy]
  ).map(({ governedBy: _governedBy, ...feature }) => feature);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/launch/ceremony-showcase.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ceremony-showcase.ts tests/launch/ceremony-showcase.test.ts
git commit -m "feat: resolve the ceremony QR target from site-url, gate features by module"
```

---

### Task 3: Audio unlock and retuned cues

Two problems. The ceremony no longer cuts a ribbon, so `playScissorSnip` is the wrong cue. And `getContext()` constructs a **new** `AudioContext` every time it finds a suspended one — browsers cap live contexts at around six, so a few rehearsals leave the ceremony silent.

**Files:**
- Modify: `src/lib/launch-audio.ts`
- Test: `tests/launch/launch-audio.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces on the exported `launchAudio` singleton: `unlock(): void`, `playTick(): void`, `playCurtainSweep(): void`, `playLaunchFanfare(): void`, `playTestTone(): void`, `setMuted(muted: boolean): void`, `getMuted(): boolean`. `playScissorSnip` is removed.

- [ ] **Step 1: Write the failing test**

Create `tests/launch/launch-audio.test.ts`. This runs in node with no `window`, which is exactly the useful thing to pin down: every cue must be safe to call in a context that has no audio at all, because a throw here white-screens the stage.

```ts
import { describe, expect, it } from "vitest";
import { launchAudio } from "@/lib/launch-audio";

describe("launchAudio", () => {
  it("round-trips the mute flag", () => {
    launchAudio.setMuted(true);
    expect(launchAudio.getMuted()).toBe(true);
    launchAudio.setMuted(false);
    expect(launchAudio.getMuted()).toBe(false);
  });

  it("never throws when there is no audio context available", () => {
    launchAudio.setMuted(false);
    expect(() => launchAudio.unlock()).not.toThrow();
    expect(() => launchAudio.playTick()).not.toThrow();
    expect(() => launchAudio.playCurtainSweep()).not.toThrow();
    expect(() => launchAudio.playLaunchFanfare()).not.toThrow();
    expect(() => launchAudio.playTestTone()).not.toThrow();
  });

  it("stays silent when muted", () => {
    launchAudio.setMuted(true);
    expect(() => launchAudio.playLaunchFanfare()).not.toThrow();
    launchAudio.setMuted(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/launch/launch-audio.test.ts`
Expected: FAIL — `launchAudio.unlock is not a function`.

- [ ] **Step 3: Fix the context lifecycle and add `unlock()`**

In `src/lib/launch-audio.ts`, replace the `getContext` method with this pair. Note it now returns `null` instead of throwing when there is no `window`, so every caller guards on it:

```ts
  /**
   * One context for the life of the page.
   *
   * This used to construct a fresh `AudioContext` whenever it found the
   * existing one suspended. Browsers cap live contexts at around six, so a
   * handful of rehearsals would exhaust the budget and the real ceremony would
   * play to a silent hall. Resume the one we have; never make another.
   *
   * Returns null off the browser (tests, SSR) rather than throwing — a stage
   * that white-screens is worse than a stage that is quiet.
   */
  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }

      if (this.ctx.state === "suspended") {
        void this.ctx.resume();
      }

      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Called from the operator's first click, and only from there.
   *
   * Browsers refuse to produce sound until the page has had a real user
   * gesture. If the fanfare is the first thing that tries, the ceremony plays
   * in silence and nobody discovers it until the moment has passed. Creating
   * and resuming the context behind an explicit operator action is what makes
   * that failure impossible.
   */
  public unlock(): void {
    this.getContext();
  }
```

- [ ] **Step 4: Replace `playScissorSnip` with the two cues the ceremony needs**

Delete the whole `playScissorSnip` method and put these in its place:

```ts
  /**
   * One beat of the count-in. Short, dry, and low enough to carry over a room
   * of two hundred people talking.
   */
  public playTick() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.09);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // A missing cue is survivable; a thrown one is not.
    }
  }

  /**
   * Heavy fabric travelling — filtered noise swept downward over the full
   * parting duration, rather than the short silk snip the ribbon used.
   */
  public playCurtainSweep() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 1.6;

      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.setValueAtTime(0.8, now);
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(280, now + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);
    } catch {
      // As above.
    }
  }
```

- [ ] **Step 5: Guard the two remaining cues**

`playLaunchFanfare` and `playTestTone` both still call `getContext()` and use the result directly. Now that it can return `null`, change the opening of each from `const ctx = this.getContext();` inside the `try` to:

```ts
    const ctx = this.getContext();
    if (!ctx) return;

    try {
```

Move the `const now = ctx.currentTime;` line inside the `try` and leave the rest of each method untouched.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/launch/launch-audio.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Verify nothing still calls the removed method**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "playScissorSnip" || echo "no references"`
Expected: the only remaining caller is the draft `launch-ceremony.tsx`, which Task 5 rewrites. If it reports that reference, that is expected at this point.

- [ ] **Step 8: Commit**

```bash
git add src/lib/launch-audio.ts tests/launch/launch-audio.test.ts
git commit -m "fix: reuse one AudioContext, add explicit unlock, retune cues for the curtain"
```

---

### Task 4: The `use-ceremony` hook

Wraps the reducer with the three things it deliberately does not know about: the passage of time, sound, and the keyboard.

**Files:**
- Create: `src/components/launch/use-ceremony.ts`

**Interfaces:**
- Consumes: `ceremonyReducer`, `INITIAL_CEREMONY`, `CeremonyStatus` from `@/lib/ceremony-machine`; `CEREMONY_TIMING`, `COUNT_IN_STEP_MS`, `CeremonyState` from `@/lib/ceremony-timing`; `launchAudio` from `@/lib/launch-audio`.
- Produces: `useCeremony(): { status: CeremonyStatus; arm(armed: boolean): void; trigger(): void; reset(): void; jump(to: CeremonyState): void }`

- [ ] **Step 1: Write the hook**

Create `src/components/launch/use-ceremony.ts`:

```ts
"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  INITIAL_CEREMONY,
  ceremonyReducer,
  type CeremonyStatus,
} from "@/lib/ceremony-machine";
import {
  CEREMONY_TIMING,
  COUNT_IN_STEP_MS,
  type CeremonyState,
} from "@/lib/ceremony-timing";
import { launchAudio } from "@/lib/launch-audio";

/**
 * The reducer decides what happens; this decides when, and makes the noise.
 *
 * Timers live here rather than in the reducer so the reducer stays pure and
 * testable — see `tests/launch/ceremony-machine.test.ts`, which is the only
 * automated coverage this page gets.
 */
export function useCeremony(): {
  status: CeremonyStatus;
  arm: (armed: boolean) => void;
  trigger: () => void;
  reset: () => void;
  jump: (to: CeremonyState) => void;
} {
  const [status, dispatch] = useReducer(ceremonyReducer, INITIAL_CEREMONY);

  const arm = useCallback((armed: boolean) => {
    // Arming is the operator's first click, so it doubles as the gesture that
    // buys us permission to make sound later.
    if (armed) launchAudio.unlock();
    dispatch({ type: "ARM", armed });
  }, []);

  const trigger = useCallback(() => dispatch({ type: "TRIGGER" }), []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);
  const jump = useCallback((to: CeremonyState) => dispatch({ type: "JUMP", to }), []);

  // Count-in: one tick per step, each with its own beat.
  useEffect(() => {
    if (status.state !== "COUNT_IN") return;

    launchAudio.playTick();
    const id = setTimeout(() => dispatch({ type: "TICK" }), COUNT_IN_STEP_MS);
    return () => clearTimeout(id);
  }, [status.state, status.count]);

  // Timed states advance themselves. PRESHOW and SHOWCASE have a null duration
  // and wait for a person instead.
  useEffect(() => {
    const duration = CEREMONY_TIMING[status.state];
    if (status.state === "COUNT_IN" || duration === null) return;

    const id = setTimeout(() => dispatch({ type: "ADVANCE" }), duration);
    return () => clearTimeout(id);
  }, [status.state]);

  // Sound cues that belong to a state's entrance.
  useEffect(() => {
    if (status.state === "PARTING") launchAudio.playCurtainSweep();
    if (status.state === "CELEBRATING") launchAudio.playLaunchFanfare();
  }, [status.state]);

  // Screen wake lock through the pre-show, so a projector idling for twenty
  // minutes does not sleep in the minute before the ceremony. Best-effort:
  // Safari has no support and a refusal here must not break anything.
  //
  // Typed structurally rather than with `WakeLockSentinel` / `navigator.wakeLock`:
  // those exist only in newer TypeScript DOM libs, and pinning the build to one
  // is not worth it for a progressive enhancement.
  type Sentinel = { release: () => Promise<void> };
  const wakeLockRef = useRef<Sentinel | null>(null);
  useEffect(() => {
    let cancelled = false;

    async function hold() {
      try {
        const wakeLock = (
          navigator as unknown as {
            wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
          }
        ).wakeLock;
        if (!wakeLock) return;

        const sentinel = await wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
      } catch {
        wakeLockRef.current = null;
      }
    }

    void hold();
    return () => {
      cancelled = true;
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, []);

  // Keyboard. Space and Enter drive the ceremony; 1-5 jump to a beat for
  // rehearsal; R re-arms.
  useEffect(() => {
    const BEATS: CeremonyState[] = [
      "PRESHOW",
      "COUNT_IN",
      "PARTING",
      "CELEBRATING",
      "SHOWCASE",
    ];

    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        trigger();
        return;
      }

      if (e.key.toLowerCase() === "r") {
        reset();
        return;
      }

      const beat = BEATS[Number(e.key) - 1];
      if (beat) jump(beat);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [trigger, reset, jump]);

  return { status, arm, trigger, reset, jump };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "use-ceremony" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/components/launch/use-ceremony.ts
git commit -m "feat: ceremony hook wiring timers, audio cues, wake lock and keyboard"
```

---

### Task 5: Skeleton composition root

This task exists so that everything after it can be *looked at*. It replaces the 406-line draft with a thin root that renders a plain text placeholder per beat. Ugly on purpose — the beats get their real treatment in Tasks 6 to 11, and from here on each of those is reviewable in a browser.

**Files:**
- Modify: `src/components/launch/launch-ceremony.tsx` (full rewrite)
- Delete: `src/components/launch/digital-ribbon.tsx`
- Modify: `src/app/launch/page.tsx` (verify only — it should need no change)

**Interfaces:**
- Consumes: `useCeremony` from `./use-ceremony`; `SiteConfig` from `@/lib/config-schema`.
- Produces: `LaunchCeremony({ config }: { config: SiteConfig })` — unchanged signature, so `page.tsx` keeps working.

- [ ] **Step 1: Replace the draft with the skeleton**

Replace the entire contents of `src/components/launch/launch-ceremony.tsx`:

```tsx
"use client";

import { Container } from "@/components/layout/container";
import { useCeremony } from "./use-ceremony";
import type { SiteConfig } from "@/lib/config-schema";

/**
 * The stage.
 *
 * Deliberately thin: `useCeremony` owns behaviour and each beat owns its own
 * appearance. Composition roots that also own layout, QR generation, audio and
 * operator controls are how the draft version of this page reached 406 lines
 * and became impossible to rehearse one beat at a time.
 */
export function LaunchCeremony({ config }: { config: SiteConfig }) {
  const { status, arm, trigger, reset } = useCeremony();

  return (
    <div className="relative min-h-svh w-full overflow-hidden bg-[hsl(0_0%_6%)] text-white">
      {/* Stage atmosphere — the same vignette and film grain the home page hero
          uses, so the ceremony reads as the same production as the site it is
          unveiling. Static, never animated: Lighthouse flags animated filters
          as non-composited, and this has to hold a steady 60fps on whatever
          machine is driving the projector. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 65% at 50% 50%, transparent 0%, rgba(0,0,0,0.6) 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <Container className="relative z-20 flex min-h-svh flex-col items-center justify-center gap-6 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-white/50">
          {config.siteName}
        </p>

        {/* Placeholder scaffolding — replaced beat by beat in Tasks 6-11. */}
        <p className="font-sans text-5xl font-extrabold tracking-[-0.035em]">
          {status.state}
        </p>
        {status.state === "COUNT_IN" && (
          <p className="font-sans text-8xl font-extrabold">{status.count}</p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <button
            onClick={() => arm(!status.armed)}
            className="rounded-xl border border-white/15 px-4 py-2"
          >
            {status.armed ? "Locked stage: armed" : "Locked stage: locked"}
          </button>
          <button
            onClick={trigger}
            className="rounded-xl bg-primary px-4 py-2 font-semibold"
          >
            Trigger
          </button>
          <button
            onClick={reset}
            className="rounded-xl border border-white/15 px-4 py-2"
          >
            Reset
          </button>
        </div>

        <p className="text-xs text-white/40">
          Space to trigger • 1-5 to jump to a beat • R to reset
        </p>
      </Container>
    </div>
  );
}
```

- [ ] **Step 2: Delete the superseded ribbon**

```bash
git rm --cached src/components/launch/digital-ribbon.tsx 2>/dev/null; rm -f src/components/launch/digital-ribbon.tsx
```

- [ ] **Step 3: Verify the page still type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `launch`.

- [ ] **Step 4: Verify it runs**

Run `npm run dev`, open `http://localhost:3000/launch`. Confirm: the page shows `PRESHOW`; pressing Space does nothing; clicking the lock button then pressing Space runs `COUNT_IN` counting 3, 2, 1 with audible ticks, then `PARTING`, `CELEBRATING`, `SHOWCASE`; keys 1-5 jump between beats; R returns to a locked `PRESHOW`.

- [ ] **Step 5: Commit**

```bash
git add src/components/launch/launch-ceremony.tsx
git add -u src/components/launch/
git commit -m "refactor: thin composition root for the ceremony, retire the ribbon"
```

---

### Task 6: The curtain

Two sliding rectangles look cheap on a large projection. Everything in this component is about not looking like two sliding rectangles.

**Files:**
- Create: `src/components/launch/curtain.tsx`
- Modify: `src/components/launch/launch-ceremony.tsx`

**Interfaces:**
- Consumes: `CeremonyState` from `@/lib/ceremony-timing`.
- Produces: `Curtain({ state }: { state: CeremonyState })`

- [ ] **Step 1: Write the component**

Create `src/components/launch/curtain.tsx`:

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PARTING_MS, type CeremonyState } from "@/lib/ceremony-timing";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Irregular pleats.
 *
 * Evenly spaced bands read as exactly what they are — a repeating CSS
 * gradient. Real fabric bunches unevenly, so these stops are deliberately
 * uneven, and the two halves use different phases so the eye never catches
 * the symmetry.
 */
function pleats(phase: number): string {
  const stops: string[] = [];
  let at = 0;

  for (let i = 0; at < 100; i++) {
    const width = 3.2 + ((i * 7 + phase) % 5) * 0.9;
    const shade = i % 2 === 0 ? "rgba(0,0,0,0.34)" : "rgba(255,255,255,0.05)";
    stops.push(`${shade} ${at}%`, `${shade} ${Math.min(at + width, 100)}%`);
    at += width;
  }

  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function Half({ side, open }: { side: "left" | "right"; open: boolean }) {
  const isLeft = side === "left";

  return (
    <motion.div
      className="absolute inset-y-0 w-1/2 origin-top"
      style={{ [isLeft ? "left" : "right"]: 0 }}
      initial={false}
      animate={
        open
          ? { x: isLeft ? "-104%" : "104%", rotate: isLeft ? -2.5 : 2.5 }
          : { x: 0, rotate: 0 }
      }
      transition={{ duration: PARTING_MS / 1000, ease: EASE }}
    >
      {/* Base cloth — deep crimson, darker than the brand primary so the
          primary still reads as the accent against it. */}
      <div className="absolute inset-0 bg-[hsl(346_60%_22%)]" />

      {/* Pleats. Different phase per side; see `pleats`. */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: pleats(isLeft ? 0 : 3) }}
      />

      {/* Sheen — a soft vertical highlight, offset per side so the halves are
          lit from the same imaginary source rather than mirrored. */}
      <div
        className="absolute inset-0"
        style={{
          background: isLeft
            ? "linear-gradient(90deg, rgba(0,0,0,0.5) 0%, transparent 45%, rgba(255,255,255,0.07) 78%, rgba(0,0,0,0.35) 100%)"
            : "linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(255,255,255,0.05) 22%, transparent 55%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* The one kasavu thread, on the leading edge. One line reads as a
          selvedge; two or three read as tinsel. */}
      <div
        className="absolute inset-y-0 w-[3px] bg-[#D4A537] shadow-[0_0_18px_rgba(212,165,55,0.6)]"
        style={{ [isLeft ? "right" : "left"]: 0 }}
      />
    </motion.div>
  );
}

/**
 * The curtain sits above the stage until the moment it does not.
 *
 * Kept mounted through PARTING so the halves animate out; removed entirely
 * afterwards so it can never intercept a click on the showcase beneath.
 */
export function Curtain({ state }: { state: CeremonyState }) {
  const reduced = useReducedMotion();

  if (state === "CELEBRATING" || state === "SHOWCASE") return null;

  const open = state === "PARTING";

  // Reduced motion shortens the travel rather than removing it. The curtain is
  // the content here, not decoration — cutting it leaves an empty stage.
  if (reduced && open) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-40">
      <Half side="left" open={open} />
      <Half side="right" open={open} />
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the composition root**

In `src/components/launch/launch-ceremony.tsx`, add the import:

```tsx
import { Curtain } from "./curtain";
```

and insert the component as the first child inside the outer `<div>`, immediately before `<Container ...>`:

```tsx
      <Curtain state={status.state} />
```

- [ ] **Step 3: Rehearse it**

Run `npm run dev`, open `/launch`. Press `1` then arm and trigger, and watch the full count-in and parting. Then press `3` repeatedly to replay just the parting. Confirm: the pleats are visibly uneven, the two halves are not mirror images, each half swings slightly rather than sliding flat, and exactly one gold line travels on each leading edge.

- [ ] **Step 4: Commit**

```bash
git add src/components/launch/curtain.tsx src/components/launch/launch-ceremony.tsx
git commit -m "feat: curtain with irregular pleats, asymmetric halves and a kasavu selvedge"
```

---

### Task 7: The count-in

**Files:**
- Create: `src/components/launch/count-in.tsx`
- Modify: `src/components/launch/launch-ceremony.tsx`

**Interfaces:**
- Consumes: nothing beyond framer-motion.
- Produces: `CountIn({ count }: { count: number })`

- [ ] **Step 1: Write the component**

Create `src/components/launch/count-in.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * One enormous numeral per beat.
 *
 * Sized in `vmin` rather than a Tailwind step because this is read from the
 * back of a hall on an unknown projector, where the useful unit is a fraction
 * of the screen rather than a pixel count.
 */
export function CountIn({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.span
          key={count}
          initial={{ opacity: 0, scale: 1.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="block font-sans font-extrabold leading-none tracking-[-0.05em] text-white tabular-nums"
          style={{ fontSize: "38vmin" }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the root**

In `launch-ceremony.tsx`, import it:

```tsx
import { CountIn } from "./count-in";
```

and replace the placeholder count-in block:

```tsx
        {status.state === "COUNT_IN" && (
          <p className="font-sans text-8xl font-extrabold">{status.count}</p>
        )}
```

with:

```tsx
        {status.state === "COUNT_IN" && <CountIn count={status.count} />}
```

- [ ] **Step 3: Rehearse it**

Run `/launch`, arm, press Space. Confirm the numeral scales down into place on each beat, is legible filling most of the screen, and the tick sound lands with it.

- [ ] **Step 4: Commit**

```bash
git add src/components/launch/count-in.tsx src/components/launch/launch-ceremony.tsx
git commit -m "feat: full-bleed count-in numerals"
```

---

### Task 8: The pre-show

**Files:**
- Create: `src/components/launch/pre-show.tsx`
- Modify: `src/components/launch/launch-ceremony.tsx`

**Interfaces:**
- Consumes: `Countdown` from `@/components/layout/countdown`; `Eyebrow` from `@/components/layout/section-heading`; `ceremonyAt()` from `@/lib/ceremony-timing`; `SiteConfig`.
- Produces: `PreShow({ config, armed, onTrigger }: { config: SiteConfig; armed: boolean; onTrigger: () => void })`

- [ ] **Step 1: Write the component**

Create `src/components/launch/pre-show.tsx`:

```tsx
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Countdown } from "@/components/layout/countdown";
import { Eyebrow } from "@/components/layout/section-heading";
import { ceremonyAt } from "@/lib/ceremony-timing";
import type { SiteConfig } from "@/lib/config-schema";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * What the projector shows for the twenty minutes before anything happens.
 *
 * The clock is atmosphere and nothing else — it never triggers the ceremony.
 * Ceremonies start late, and a page that fires itself on a schedule fires into
 * a room that is not ready.
 */
export function PreShow({
  config,
  armed,
  onTrigger,
}: {
  config: SiteConfig;
  armed: boolean;
  onTrigger: () => void;
}) {
  const at = ceremonyAt();
  // `Countdown` renders nothing once its target passes, which on a ceremony
  // running ten minutes behind would leave the stage blank at the exact moment
  // the hall looks up. Decide up front whether there is a future moment to
  // count towards, and hold a line instead when there is not.
  //
  // This holds the Date itself rather than a boolean so the JSX below narrows:
  // a separate `const upcoming = at !== null && ...` does not narrow `at`, and
  // `targetDate={at}` would fail to compile against `Date | null`.
  const upcoming = at && at.getTime() > Date.now() ? at : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, ease: EASE }}
      className="flex flex-col items-center gap-8 text-center"
    >
      <Image
        src={config.branding.logoUrl || "/images/logo.png"}
        alt={config.siteName}
        width={96}
        height={96}
        className="h-20 w-auto"
        priority
      />

      <Eyebrow tone="dark">Grand Inauguration</Eyebrow>

      {upcoming ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm uppercase tracking-[0.22em] text-white/50">
            The unveiling begins in
          </p>
          <Countdown targetDate={upcoming} />
        </div>
      ) : (
        <p className="font-sans text-2xl font-extrabold tracking-[-0.035em] text-white/80">
          Beginning shortly
        </p>
      )}

      <button
        type="button"
        onClick={onTrigger}
        disabled={!armed}
        aria-label="Unveil the website"
        className={cn(
          "mt-4 rounded-2xl px-12 py-6 font-sans text-2xl font-extrabold tracking-[-0.02em] transition-all",
          armed
            ? "bg-primary text-white shadow-[0_0_60px_-10px_hsl(346.8_77.2%_49.8%)] hover:scale-[1.03] active:scale-[0.98]"
            : "cursor-not-allowed border border-white/10 bg-white/5 text-white/30"
        )}
      >
        {armed ? "Unveil" : "Stage locked"}
      </button>

      {armed && (
        <p className="text-xs text-white/40">
          Press the button, or the spacebar
        </p>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: Wire it into the root**

In `launch-ceremony.tsx`, import it and render it in place of the `{status.state}` placeholder paragraph, so the root's body becomes:

```tsx
        {status.state === "PRESHOW" && (
          <PreShow config={config} armed={status.armed} onTrigger={trigger} />
        )}
        {status.state === "COUNT_IN" && <CountIn count={status.count} />}
```

Delete the now-unused `<p className="text-xs uppercase ...">{config.siteName}</p>` and `<p className="font-sans text-5xl ...">{status.state}</p>` placeholders.

- [ ] **Step 3: Rehearse both clock states**

Run `/launch` with `NEXT_PUBLIC_CEREMONY_AT` unset. Confirm "Beginning shortly" shows and the button reads "Stage locked". Then restart dev with a future value, e.g.

```bash
NEXT_PUBLIC_CEREMONY_AT="2027-01-01T18:00:00+01:00" npm run dev
```

Confirm the rolling reels appear. Then set a value in the past and confirm it falls back to "Beginning shortly" rather than going blank.

- [ ] **Step 4: Commit**

```bash
git add src/components/launch/pre-show.tsx src/components/launch/launch-ceremony.tsx
git commit -m "feat: pre-show stage with the ceremony clock and the unveil button"
```

---

### Task 9: The title card, and the confetti palette

**Files:**
- Create: `src/components/launch/title-card.tsx`
- Modify: `src/components/launch/confetti-canvas.tsx:50-59`
- Modify: `src/components/launch/launch-ceremony.tsx`

**Interfaces:**
- Consumes: `Accent` from `@/components/layout/section-heading`; `ConfettiCanvas` from `./confetti-canvas`; `SiteConfig`.
- Produces: `TitleCard({ config }: { config: SiteConfig })`

- [ ] **Step 1: Re-palettize the confetti**

In `src/components/launch/confetti-canvas.tsx`, replace the whole `const colors = [...]` array and its comment with:

```ts
    // Four colours, all of them the house palette: crimson, kasavu gold, cream,
    // white. The draft threw indigo and emerald in as well, which read as a
    // birthday party rather than this association's brand.
    const colors = ["#E11D48", "#D4A537", "#F5EFE6", "#FFFFFF"];
```

- [ ] **Step 2: Write the title card**

Create `src/components/launch/title-card.tsx`:

```tsx
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Accent } from "@/components/layout/section-heading";
import type { SiteConfig } from "@/lib/config-schema";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The moment itself: what the hall sees the instant the curtain clears.
 *
 * One serif italic word in crimson, exactly as the home page hero does it. The
 * draft used a gold gradient fill across the whole headline, which belongs to
 * no part of this brand.
 */
export function TitleCard({ config }: { config: SiteConfig }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.1, ease: EASE }}
      className="flex flex-col items-center gap-8 text-center"
    >
      <Image
        src={config.branding.logoUrl || "/images/logo.png"}
        alt={config.siteName}
        width={128}
        height={128}
        className="h-24 w-auto"
        priority
      />

      <h1 className="max-w-4xl text-balance font-sans text-5xl font-extrabold leading-[1.06] tracking-[-0.035em] text-white md:text-7xl">
        {config.siteName} is <Accent>live</Accent>
      </h1>

      <p className="max-w-xl text-base leading-relaxed text-white/60">
        Our digital home is open. Everything the community does, in one place.
      </p>
    </motion.div>
  );
}
```

- [ ] **Step 3: Wire both into the root**

In `launch-ceremony.tsx`, import `TitleCard` and `ConfettiCanvas`, render the card for the two final beats, and fire confetti on `CELEBRATING`:

```tsx
        {(status.state === "CELEBRATING" || status.state === "SHOWCASE") && (
          <TitleCard config={config} />
        )}
```

and, as a sibling of `<Curtain ... />` inside the outer `<div>`:

```tsx
      <ConfettiCanvas active={status.state === "CELEBRATING"} originX={0.5} originY={0.45} />
```

- [ ] **Step 4: Rehearse it**

Run `/launch`, press `4` to jump to `CELEBRATING`. Confirm: confetti fires in crimson, gold, cream and white only; the fanfare plays; "live" is a crimson serif italic and everything else is white Manrope; after four seconds it moves to `SHOWCASE`.

- [ ] **Step 5: Commit**

```bash
git add src/components/launch/title-card.tsx src/components/launch/confetti-canvas.tsx src/components/launch/launch-ceremony.tsx
git commit -m "feat: title card with the house serif accent, confetti on brand"
```

---

### Task 10: The showcase panel

**Files:**
- Create: `src/components/launch/showcase-panel.tsx`
- Modify: `src/components/launch/launch-ceremony.tsx`

**Interfaces:**
- Consumes: `qrTarget()`, `ceremonyFeatures()` from `@/lib/ceremony-showcase`; `SiteConfig`.
- Produces: `ShowcasePanel({ config }: { config: SiteConfig })`

- [ ] **Step 1: Write the component**

Create `src/components/launch/showcase-panel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { ceremonyFeatures, qrTarget } from "@/lib/ceremony-showcase";
import type { SiteConfig } from "@/lib/config-schema";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * What the hall looks at while they get their phones out.
 *
 * The QR is generated at error-correction level H and rendered large. A
 * projector's keystone correction and focus both work against a scan from
 * fifteen metres away, and H tolerates roughly a third of the code being
 * unreadable — which is the difference between a room full of successful scans
 * and a room full of people giving up.
 */
export function ShowcasePanel({ config }: { config: SiteConfig }) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const target = qrTarget();
  const features = ceremonyFeatures(config);
  const url = target.ok ? target.url : null;

  useEffect(() => {
    if (!url) return;

    QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      width: 1024,
      margin: 3,
      color: { dark: "#0A0A0A", light: "#FFFFFF" },
    })
      .then(setQrImage)
      .catch(() => setQrImage(null));
  }, [url]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: EASE, delay: 0.15 }}
      className="grid w-full max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-12"
    >
      <div className="flex flex-col items-center gap-4 md:col-span-5">
        {target.ok ? (
          <>
            <div className="rounded-2xl bg-white p-4 shadow-2xl">
              {qrImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrImage}
                  alt={`QR code linking to ${target.url}`}
                  className="h-56 w-56 object-contain md:h-72 md:w-72"
                />
              ) : (
                <div className="h-56 w-56 md:h-72 md:w-72" />
              )}
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/50">
              Scan to open
            </p>
            {/* Printed large on purpose: it lets the operator confirm the
                destination at a glance, and anyone whose camera will not scan
                can simply type it. */}
            <p className="font-sans text-xl font-extrabold tracking-[-0.02em] text-white">
              {target.url.replace(/^https:\/\//, "")}
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-primary/40 bg-primary/10 p-6 text-left">
            <p className="font-sans text-base font-extrabold text-white">
              No QR code — the site address is not configured
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              {target.reason}
            </p>
          </div>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-7">
        {features.map((feature) => (
          <li
            key={feature.key}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left"
          >
            <p className="font-sans text-base font-extrabold tracking-[-0.02em] text-white">
              {feature.title}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/55">
              {feature.blurb}
            </p>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
```

**Deliberate deviation from the spec.** The spec's brand table says feature
icons become "all crimson, uniform weight". These cards carry no icons at all.
Four icons in a single colour add no information a two-word title does not
already carry, and the house voice is editorial — the home page's own section
cards lead with type, not glyphs. Do not add icons back.

- [ ] **Step 2: Wire it into the root**

Import `ShowcasePanel` and render it under the title card:

```tsx
        {status.state === "SHOWCASE" && <ShowcasePanel config={config} />}
```

- [ ] **Step 3: Rehearse both branches**

With `NEXT_PUBLIC_APP_URL` unset, press `5` and confirm the crimson "no QR" notice appears naming the variable — **not** a QR pointing at localhost. Then restart with

```bash
NEXT_PUBLIC_APP_URL="https://keralasamajam.de" npm run dev
```

press `5`, and scan the code with a phone to confirm it opens the live site. Step back to the far side of the room and scan again.

- [ ] **Step 4: Commit**

```bash
git add src/components/launch/showcase-panel.tsx src/components/launch/launch-ceremony.tsx
git commit -m "feat: showcase panel with a level-H QR and module-gated features"
```

---

### Task 11: The operator bar and pre-flight panel

Five silent failure modes become five things a person can see and fix while there is still time.

**Files:**
- Create: `src/components/launch/operator-bar.tsx`
- Modify: `src/components/launch/launch-ceremony.tsx`

**Interfaces:**
- Consumes: `qrTarget()` from `@/lib/ceremony-showcase`; `launchAudio` from `@/lib/launch-audio`; `CeremonyState` from `@/lib/ceremony-timing`.
- Produces: `OperatorBar({ state, armed, onArm, onReset }: { state: CeremonyState; armed: boolean; onArm: (armed: boolean) => void; onReset: () => void })`

- [ ] **Step 1: Write the component**

Create `src/components/launch/operator-bar.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { qrTarget } from "@/lib/ceremony-showcase";
import { launchAudio } from "@/lib/launch-audio";
import type { CeremonyState } from "@/lib/ceremony-timing";
import { cn } from "@/lib/utils";

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          ok ? "bg-emerald-400" : "bg-primary"
        )}
      />
      <span className={ok ? "text-white/60" : "text-white"}>{label}</span>
    </span>
  );
}

/**
 * Operator-only. Visible before the ceremony, gone the moment it starts, so
 * nothing but the ceremony is on screen when the hall is watching.
 *
 * The pre-flight row is the most valuable thing on this page. Every item on it
 * is a failure that is otherwise completely silent until the moment it ruins:
 * a QR pointing nowhere, a muted stage, a projector that went to sleep.
 */
export function OperatorBar({
  state,
  armed,
  onArm,
  onReset,
}: {
  state: CeremonyState;
  armed: boolean;
  onArm: (armed: boolean) => void;
  onReset: () => void;
}) {
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);

  const target = qrTarget();

  useEffect(() => {
    void document.fonts?.ready.then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const testSound = useCallback(() => {
    launchAudio.unlock();
    launchAudio.playTestTone();
    setAudioUnlocked(true);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  // Off-stage the instant the ceremony begins.
  if (state !== "PRESHOW") {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={onReset}
          className="rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white/40 backdrop-blur hover:text-white"
        >
          Re-arm
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/70 px-6 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-semibold uppercase tracking-[0.18em] text-white/35">
            Pre-flight
          </span>
          <Check
            ok={target.ok}
            label={target.ok ? `QR → ${target.url.replace(/^https:\/\//, "")}` : "QR URL not configured"}
          />
          <Check ok={audioUnlocked} label={audioUnlocked ? "Audio ready" : "Audio not tested"} />
          <Check ok={fullscreen} label={fullscreen ? "Fullscreen" : "Not fullscreen"} />
          <Check ok={fontsReady} label={fontsReady ? "Fonts loaded" : "Fonts loading"} />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={testSound}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-white/70 hover:text-white"
          >
            Test sound
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-white/70 hover:text-white"
          >
            Fullscreen
          </button>
          <button
            onClick={() => onArm(!armed)}
            className={cn(
              "rounded-lg px-3 py-1.5 font-semibold",
              armed
                ? "bg-primary text-white"
                : "border border-white/10 text-white/70 hover:text-white"
            )}
          >
            {armed ? "Armed — press to lock" : "Locked — press to arm"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Note the wake-lock check named in the spec is not surfaced here: `useCeremony` holds the sentinel internally and a failure to acquire it is already non-fatal. Surfacing it would mean threading state out of the hook for a row nobody can act on — the projector's own sleep setting is the actual fix. Fullscreen, which the operator *can* act on, covers the same ground.

- [ ] **Step 2: Wire it into the root**

Import `OperatorBar` and render it as the last child of the outer `<div>`, outside `<Container>`:

```tsx
      <OperatorBar
        state={status.state}
        armed={status.armed}
        onArm={arm}
        onReset={reset}
      />
```

Then delete the temporary arm/trigger/reset button row and the keyboard-hint paragraph from Task 5's skeleton — the operator bar and `PreShow` now own all of it.

- [ ] **Step 3: Rehearse the whole thing end to end**

Run `/launch`. Confirm: the pre-flight row shows crimson dots for anything unset; "Test sound" plays a tone and turns the audio dot green; arming enables the Unveil button; pressing it runs count-in → curtain → confetti → showcase with the operator bar gone throughout; the "Re-arm" corner button returns to a **locked** pre-show.

- [ ] **Step 4: Commit**

```bash
git add src/components/launch/operator-bar.tsx src/components/launch/launch-ceremony.tsx
git commit -m "feat: operator bar with a pre-flight checklist"
```

---

### Task 12: Full verification

**Files:**
- Modify: none expected.

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: PASS, including the three new files under `tests/launch/`. Report any pre-existing failures rather than fixing them here.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds, and `/launch` appears in the route list.

- [ ] **Step 4: Confirm the lamp footage is still excluded**

Run: `git status --porcelain public/lamp | head`
Expected: no output — it is gitignored.

- [ ] **Step 5: Confirm no stray references survive**

Run: `grep -rn "digital-ribbon\|playScissorSnip\|window.location.origin" src/components/launch src/lib/launch-audio.ts src/lib/ceremony-*.ts || echo "clean"`
Expected: `clean`.

- [ ] **Step 6: Commit anything outstanding**

```bash
git status --short
```

Expected: nothing under `src/` or `tests/` left uncommitted.

---

## Deployment note

The QR depends on `NEXT_PUBLIC_APP_URL` being set to `https://keralasamajam.de` **on the deployment the projector will actually open**. If it is not set, the ceremony deliberately shows no QR at all. Verify this on the real machine, on the real network, before the day — the pre-flight row is there to make it a five-second check.

`NEXT_PUBLIC_CEREMONY_AT` is optional; without it the pre-show holds "Beginning shortly" instead of a clock.
