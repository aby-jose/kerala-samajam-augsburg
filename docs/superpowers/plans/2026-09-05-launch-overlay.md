# Launch Ceremony Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the website-launch ceremony off `/launch` and onto the real home page as a key-summoned overlay, with the page itself scaled into the stage screen and grown back to full size at the end.

**Architecture:** A `Ceremony` client component in the public layout wraps the page tree in one transformable, clippable `div` and mounts a lazy-loaded overlay above it when Alt+Shift+L is pressed and `features.launchCeremony` is on. The overlay owns the ceremony state machine and reports its state and the screen box up; the wrapper turns those into one CSS transform on the page. The iframe, QR card, and `/launch` route are removed.

**Tech Stack:** Next.js 16 app router, React 19, framer-motion, Tailwind, zod, vitest (node, no jsdom).

**Spec:** `docs/superpowers/specs/2026-09-05-launch-overlay-design.md`

## Global Constraints

- Do not commit. Aby commits (memory: never commit unless asked; no Co-Authored-By trailer).
- Never edit DB content directly; the new switch is set through Settings.
- The reducer stays pure and node-testable; no React in `src/lib/ceremony-*`.
- Lint scope: `npx eslint src/components/launch src/lib/ceremony-timing.ts src/lib/ceremony-machine.ts src/lib/ceremony-event.ts src/components/legal/cookie-consent.tsx "src/app/(public)/layout.tsx" "src/app/admin/(dashboard)/settings/settings-client.tsx" tests/launch tests/config-utils.test.ts --max-warnings=0` (the repo has pre-existing lint errors outside this scope).
- Chord: Alt+Shift+L (`e.altKey && e.shiftKey && e.code === "KeyL"`).
- Screen width expression, unchanged: `min(84vw, 124vmin, 104vh)`.
- Beats: PRESHOW, COUNT_IN, PARTING, LIGHT_UP, CELEBRATING, HOLD, GROW, OFF. Alt+1…7 jump to the first seven. OFF is terminal.
- Durations: COUNT_IN 3×1000 ms, PARTING 5000, LIGHT_UP 1400+1300, CELEBRATING 6000, GROW 2600. GROW advances to OFF on its timer (the spec's "on LAND" is implemented as this timer; the page transform uses the same duration).

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/ceremony-timing.ts` | State names, running order, durations. Modify. |
| `src/lib/ceremony-machine.ts` | Pure reducer. Modify. |
| `src/lib/ceremony-event.ts` | The `ksa:ceremony` window event name. Create. |
| `src/components/launch/use-ceremony.ts` | Timers, audio, keyboard. Modify. |
| `src/components/launch/stage-screen.tsx` | The screen's bezel, dark panel, gloss; reports its box. Create. |
| `src/components/launch/ceremony-overlay.tsx` | The house above the page: stage, curtain, effects, front, operator bar. Create (from `launch-ceremony.tsx`). |
| `src/components/launch/ceremony.tsx` | The wrapper in the layout: chord, lazy load, page transform, scroll lock, video pause. Create. |
| `src/components/launch/curtain.tsx` | `gone` on GROW/OFF. Modify. |
| `src/components/launch/operator-bar.tsx` | Drop the QR line and prop; new shortcut list. Modify. |
| `src/components/legal/cookie-consent.tsx` | Revert frame guard; close on ceremony event. Modify. |
| `src/app/(public)/layout.tsx` | Wrap the page tree in `Ceremony`. Modify. |
| `src/lib/config-schema.ts`, `src/lib/feature-gate.ts`, `src/app/admin/(dashboard)/settings/settings-client.tsx` | The switch. Modify. |
| `next.config.ts` | Revert to `DENY` / `frame-ancestors 'none'`. Modify. |
| Delete | `src/app/launch/page.tsx`, `src/components/launch/{browser-reveal,qr-card,showcase-panel,title-card,launch-ceremony}.tsx`, `src/lib/{launch-screen,ceremony-showcase}.ts`, `tests/launch/ceremony-showcase.test.ts`, `.render-curtain.tsx`, `.render-reveal.tsx`. |

---

### Task 1: Beats and reducer

**Files:**
- Modify: `src/lib/ceremony-timing.ts`
- Modify: `src/lib/ceremony-machine.ts`
- Test: `tests/launch/ceremony-machine.test.ts`

**Interfaces:**
- Produces: `CeremonyState` union with the eight beats; `CEREMONY_ORDER: CeremonyState[]` (seven, no OFF); `LIGHT_UP_HOLD_MS`, `LIGHT_UP_MS`, `GROW_MS`; `CEREMONY_TIMING` with `HOLD: null`, `OFF: null`, `GROW: GROW_MS`. Reducer: TRIGGER at HOLD → GROW; ADVANCE GROW → OFF.

- [ ] **Step 1: Rewrite the reducer tests for the new beats**

Replace the body of `describe("ceremonyReducer", …)` in `tests/launch/ceremony-machine.test.ts` with:

```ts
describe("ceremonyReducer", () => {
  it("arms the stage while in PRESHOW", () => {
    const next = ceremonyReducer(INITIAL_CEREMONY, { type: "ARM", armed: true });
    expect(next.armed).toBe(true);
  });

  it("ignores ARM once the stage has left PRESHOW", () => {
    const s: CeremonyStatus = { ...armed, state: "CELEBRATING" };
    expect(ceremonyReducer(s, { type: "ARM", armed: false })).toEqual(s);
  });

  it("refuses to trigger while the stage is locked", () => {
    const next = ceremonyReducer(INITIAL_CEREMONY, { type: "TRIGGER" });
    expect(next.state).toBe("PRESHOW");
  });

  it("starts the count-in when armed", () => {
    const next = ceremonyReducer(armed, { type: "TRIGGER" });
    expect(next.state).toBe("COUNT_IN");
    expect(next.count).toBe(COUNT_IN_FROM);
  });

  it("ignores a second trigger during the count-in", () => {
    const s: CeremonyStatus = { ...armed, state: "COUNT_IN", count: 2 };
    expect(ceremonyReducer(s, { type: "TRIGGER" })).toEqual(s);
  });

  it("counts down one numeral per tick and parts the curtain after 1", () => {
    let s: CeremonyStatus = { ...armed, state: "COUNT_IN", count: 3 };
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

  it("advances parting to light-up to celebrating to hold", () => {
    let s: CeremonyStatus = { ...armed, state: "PARTING" };
    s = ceremonyReducer(s, { type: "ADVANCE" });
    expect(s.state).toBe("LIGHT_UP");
    s = ceremonyReducer(s, { type: "ADVANCE" });
    expect(s.state).toBe("CELEBRATING");
    s = ceremonyReducer(s, { type: "ADVANCE" });
    expect(s.state).toBe("HOLD");
  });

  it("holds until a person presses", () => {
    const s: CeremonyStatus = { ...armed, state: "HOLD" };
    expect(ceremonyReducer(s, { type: "ADVANCE" })).toEqual(s);
  });

  it("grows the site to full screen when the hold is triggered, armed or not", () => {
    const s: CeremonyStatus = { ...INITIAL_CEREMONY, state: "HOLD", armed: false };
    expect(ceremonyReducer(s, { type: "TRIGGER" }).state).toBe("GROW");
  });

  it("switches the overlay off when the grow has run", () => {
    const s: CeremonyStatus = { ...armed, state: "GROW" };
    expect(ceremonyReducer(s, { type: "ADVANCE" }).state).toBe("OFF");
  });

  it("ignores every press once off", () => {
    const s: CeremonyStatus = { ...armed, state: "OFF" };
    expect(ceremonyReducer(s, { type: "TRIGGER" })).toEqual(s);
    expect(ceremonyReducer(s, { type: "ADVANCE" })).toEqual(s);
  });

  it("lists the seven visible beats in running order, without OFF", () => {
    expect(CEREMONY_ORDER).toEqual([
      "PRESHOW", "COUNT_IN", "PARTING", "LIGHT_UP", "CELEBRATING", "HOLD", "GROW",
    ]);
  });

  it("re-locks the stage on reset so a rehearsal cannot leave it live", () => {
    const s: CeremonyStatus = { ...armed, state: "HOLD" };
    const next = ceremonyReducer(s, { type: "RESET" });
    expect(next).toEqual(INITIAL_CEREMONY);
    expect(next.armed).toBe(false);
  });

  it("jumps straight to any beat for rehearsal", () => {
    const next = ceremonyReducer(INITIAL_CEREMONY, { type: "JUMP", to: "CELEBRATING" });
    expect(next.state).toBe("CELEBRATING");
  });

  it("keeps the stage armed when jumping to a beat that is not PRESHOW", () => {
    const s: CeremonyStatus = { ...armed, state: "HOLD" };
    const next = ceremonyReducer(s, { type: "JUMP", to: "PARTING" });
    expect(next.state).toBe("PARTING");
    expect(next.armed).toBe(true);
  });

  it("re-locks the stage when jumping back to PRESHOW, matching RESET", () => {
    const s: CeremonyStatus = { ...armed, state: "HOLD" };
    const next = ceremonyReducer(s, { type: "JUMP", to: "PRESHOW" });
    expect(next.state).toBe("PRESHOW");
    expect(next.armed).toBe(false);
  });

  it("leaves PRESHOW, HOLD and OFF with no duration, since all three wait for a person", () => {
    expect(CEREMONY_TIMING.PRESHOW).toBeNull();
    expect(CEREMONY_TIMING.HOLD).toBeNull();
    expect(CEREMONY_TIMING.OFF).toBeNull();
  });

  it("gives COUNT_IN, PARTING, LIGHT_UP, CELEBRATING and GROW a positive duration, since all advance on their own", () => {
    expect(CEREMONY_TIMING.COUNT_IN).toBeGreaterThan(0);
    expect(CEREMONY_TIMING.PARTING).toBeGreaterThan(0);
    expect(CEREMONY_TIMING.LIGHT_UP).toBeGreaterThan(0);
    expect(CEREMONY_TIMING.CELEBRATING).toBeGreaterThan(0);
    expect(CEREMONY_TIMING.GROW).toBeGreaterThan(0);
  });
});
```

Keep the existing imports and the `armed` constant; keep the `describe("ceremonyAt", …)` block as it is. The import line must read:

```ts
import { CEREMONY_ORDER, CEREMONY_TIMING, ceremonyAt, COUNT_IN_FROM } from "@/lib/ceremony-timing";
```

- [ ] **Step 2: Run the test file and watch it fail**

Run: `npx vitest run tests/launch/ceremony-machine.test.ts`
Expected: failures on "LIGHT_UP", "HOLD", "GROW", "OFF" (type errors surface as runtime mismatches in vitest).

- [ ] **Step 3: Rewrite the timing module**

Replace the top of `src/lib/ceremony-timing.ts` down to (not including) the `ceremonyAt` doc comment with:

```ts
/**
 * Every duration the ceremony depends on, in one place.
 *
 * These get tuned in rehearsal, standing in the actual hall, watching the
 * actual projector. Hunting them down inside animation props is how a
 * rehearsal note turns into a half-hour of grep, so they live here instead.
 */

/**
 * The beats. The ceremony is an overlay on the home page: the page is scaled
 * into a screen on the stage, the curtain draws on it, and at the end the
 * page grows back to full size and the overlay goes away.
 *
 *   PRESHOW      closed curtain, logo and name; waits for the operator
 *   COUNT_IN     numerals over the cloth
 *   PARTING      the legs draw; the page is already on the screen, dark
 *   LIGHT_UP     the dark panel lifts and the page shows on the screen
 *   CELEBRATING  fireworks and confetti
 *   HOLD         the picture held, quieter; waits for the operator
 *   GROW         the curtain flies out and the page grows to fill the frame
 *   OFF          the overlay is gone; the plain site remains
 */
export type CeremonyState =
  | "PRESHOW"
  | "COUNT_IN"
  | "PARTING"
  | "LIGHT_UP"
  | "CELEBRATING"
  | "HOLD"
  | "GROW"
  | "OFF";

/**
 * The visible beats, in the order they run. The rehearsal jump keys index
 * this: Alt+1 is PRESHOW, Alt+7 is GROW. OFF is not a place to jump to — it
 * is the overlay being gone.
 */
export const CEREMONY_ORDER: CeremonyState[] = [
  "PRESHOW",
  "COUNT_IN",
  "PARTING",
  "LIGHT_UP",
  "CELEBRATING",
  "HOLD",
  "GROW",
];

/**
 * The count-in starts here and steps down to 1, then the curtain moves.
 *
 * Three seconds for now — set short while the beats after it are being
 * rehearsed. The ten-from-900ms count the ceremony was written with is a
 * two-number change here when the show is being timed for real.
 */
export const COUNT_IN_FROM = 3;
export const COUNT_IN_STEP_MS = 1000;

/**
 * The draw.
 *
 * A house traveller is a heavy thing on a motor: it leans into the move, runs,
 * and settles. Under three seconds it read as a wipe transition — the hall saw
 * an animation rather than a curtain going up — so it is paced to something a
 * stagehand would recognise.
 */
export const PARTING_MS = 5000;

/**
 * The light-up: the screen in the opening stands dark for a moment after the
 * curtain settles, then the page shows on it. The hold is what makes the
 * light-up an event rather than a continuation of the draw; the rest is the
 * page settling before the celebration is thrown.
 */
export const LIGHT_UP_HOLD_MS = 1400;
export const LIGHT_UP_MS = LIGHT_UP_HOLD_MS + 1300;

export const CELEBRATING_MS = 6000;

/**
 * The grow: the curtain flies out and the page's transform runs back to
 * identity, so the site fills the frame. Paced like a slow dolly-in, not a
 * cut. One duration, because the legs, the valance and the page all move
 * together and must arrive together; when it elapses the overlay is switched
 * off.
 */
export const GROW_MS = 2600;

/**
 * How long each state lasts before advancing on its own.
 *
 * `null` means "waits for a person": PRESHOW until the operator presses, HOLD
 * until the operator presses again, OFF because there is nothing after it.
 */
export const CEREMONY_TIMING: Record<CeremonyState, number | null> = {
  PRESHOW: null,
  COUNT_IN: COUNT_IN_FROM * COUNT_IN_STEP_MS,
  PARTING: PARTING_MS,
  LIGHT_UP: LIGHT_UP_MS,
  CELEBRATING: CELEBRATING_MS,
  HOLD: null,
  GROW: GROW_MS,
  OFF: null,
};
```

- [ ] **Step 4: Update the reducer**

In `src/lib/ceremony-machine.ts`, replace the `NEXT` table and its comment, and the `TRIGGER` case:

```ts
/**
 * What each timed beat hands over to.
 *
 * COUNT_IN is absent on purpose: it advances a numeral at a time through TICK,
 * and only the last tick moves the state on. PRESHOW and HOLD are absent
 * because they wait for a person; OFF because nothing follows it.
 */
const NEXT: Partial<Record<CeremonyState, CeremonyState>> = {
  PARTING: "LIGHT_UP",
  LIGHT_UP: "CELEBRATING",
  CELEBRATING: "HOLD",
  GROW: "OFF",
};
```

```ts
    case "TRIGGER":
      // The second press of the evening: with the site on the screen and the
      // celebration done, the same key grows it to full screen. No arming
      // check here — the show is already running, and there is nothing left
      // to protect.
      if (status.state === "HOLD") return { ...status, state: "GROW" };

      // Guards both the locked stage and the double press: a guest leaning on
      // the button, or a nervous double-click, must not restart the count.
      if (status.state !== "PRESHOW" || !status.armed) return status;
      return { ...status, state: "COUNT_IN", count: COUNT_IN_FROM };
```

- [ ] **Step 5: Run the test file and watch it pass**

Run: `npx vitest run tests/launch/ceremony-machine.test.ts`
Expected: all green. (Other files will not typecheck until Tasks 3–6; that is expected here.)

---

### Task 2: The switch

**Files:**
- Modify: `src/lib/config-schema.ts` (features type at ~line 57 and defaults at ~line 264)
- Modify: `src/lib/feature-gate.ts` (`FeatureKey`, ~line 30)
- Modify: `src/app/admin/(dashboard)/settings/settings-client.tsx` (zod `features` at ~line 90; Modules panel after the Gallery switch)
- Test: `tests/config-utils.test.ts`

**Interfaces:**
- Produces: `SiteConfig["features"]["launchCeremony"]: boolean`, default `false`.

- [ ] **Step 1: Add the merge test**

Append inside `describe("getConfig", …)` in `tests/config-utils.test.ts`:

```ts
  it("switches the launch ceremony off for a config saved before it existed", async () => {
    const { launchCeremony: _ignored, ...storedFeatures } = defaultConfig.features;
    mockedFindUnique.mockResolvedValue({
      key: "current",
      value: { ...defaultConfig, features: storedFeatures },
    } as any);

    const config = await loadConfig();

    expect(config.features.launchCeremony).toBe(false);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/config-utils.test.ts`
Expected: FAIL — `launchCeremony` does not exist on the defaults.

- [ ] **Step 3: Add the key**

In `src/lib/config-schema.ts`, the features type becomes:

```ts
  features: {
    enableRegistration: boolean;
    enableGallery: boolean;
    enableMembership: boolean;
    maintenanceMode: boolean;
    /**
     * The website-launch ceremony, as an overlay on the home page. Off, the
     * home page ships nothing extra; on, Alt+Shift+L on the home page brings
     * the curtain in. See `components/launch/ceremony.tsx`.
     */
    launchCeremony: boolean;
  };
```

and the defaults:

```ts
  features: {
    enableRegistration: true,
    enableGallery: true,
    enableMembership: true,
    maintenanceMode: false,
    launchCeremony: false,
  },
```

In `src/lib/feature-gate.ts`:

```ts
/**
 * The modules an administrator can switch off.
 *
 * `maintenanceMode` is deliberately excluded: it is not a module, it seals the
 * whole site, and it answers to `isMaintenanceLocked` instead.
 * `launchCeremony` is excluded for the opposite reason: it gates no route and
 * no action, only whether the home page listens for the operator's chord.
 */
export type FeatureKey = Exclude<
  keyof SiteConfig["features"],
  "maintenanceMode" | "launchCeremony"
>;
```

In `settings-client.tsx`, the zod `features` object gains `launchCeremony: z.boolean(),` after `maintenanceMode`. In the Modules panel, directly after the Gallery switch's closing `</div>` (the last `flex items-center justify-between gap-4 py-4` block inside `divide-y divide-border`, before the `</div>` that closes `divide-y`), add:

```tsx
                      <div className="flex items-center justify-between gap-4 py-4">
                        <div className="space-y-0.5">
                          <h4 className="font-sans text-sm font-medium text-foreground">Launch ceremony</h4>
                          <p className="max-w-md text-xs text-muted-foreground">
                            Lets the home page stage the website-launch ceremony. With this on, Alt+Shift+L on the home page brings the curtain in; visitors see nothing until then. Turn it off after the event.
                          </p>
                        </div>
                        <Switch
                          checked={watch("features.launchCeremony")}
                          onCheckedChange={(val) => setValue("features.launchCeremony", val)}
                        />
                      </div>
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run tests/config-utils.test.ts tests/feature-gate.test.ts`
Expected: PASS.

---

### Task 3: Remove the frame, the QR, and the route

**Files:**
- Delete: `src/app/launch/page.tsx` (and the now-empty `src/app/launch/`), `src/components/launch/browser-reveal.tsx`, `src/components/launch/qr-card.tsx`, `src/components/launch/showcase-panel.tsx`, `src/components/launch/title-card.tsx`, `src/lib/launch-screen.ts`, `src/lib/ceremony-showcase.ts`, `tests/launch/ceremony-showcase.test.ts`, `.render-curtain.tsx`, `.render-reveal.tsx`
- Modify: `next.config.ts` (headers, ~lines 60–88)
- Modify: `src/components/legal/cookie-consent.tsx` (remove the frame guard at ~line 94–99)
- Modify: `src/components/launch/operator-bar.tsx`

- [ ] **Step 1: Delete the files**

```bash
git rm -q src/app/launch/page.tsx src/lib/ceremony-showcase.ts tests/launch/ceremony-showcase.test.ts src/components/launch/showcase-panel.tsx src/components/launch/title-card.tsx
rm -f src/components/launch/browser-reveal.tsx src/components/launch/qr-card.tsx src/lib/launch-screen.ts .render-curtain.tsx .render-reveal.tsx
rmdir src/app/launch
```

(`browser-reveal.tsx` is tracked; `git rm` it too if `rm` leaves it listed as deleted — either is fine, the tree is what matters.)

- [ ] **Step 2: Revert the framing headers**

In `next.config.ts` the comment paragraph beginning "`frame-ancestors 'self'` is the one that matters most here" goes back to:

```ts
   * `frame-ancestors 'none'` is the one that matters most here: without it the
   * admin panel could be framed by another site and clicked through by a
   * signed-in administrator.
```

and the two headers back to `{ key: "X-Frame-Options", value: "DENY" }` and `value: "frame-ancestors 'none'; object-src 'none'"`.

- [ ] **Step 3: Remove the frame guard from the cookie banner**

In `cookie-consent.tsx`, delete the comment block and the line `if (window.self !== window.top) return;` at the top of the first `useEffect`, so it begins again with `const existing = readConsentCookie();`.

- [ ] **Step 4: Trim the operator bar**

In `operator-bar.tsx`: remove `import type { QrTarget } from "@/lib/ceremony-showcase";`, the `qr` prop and its doc line, `const target = qr;`, and the `<Check ok={target.ok} … />` line. Replace `SHORTCUTS` with:

```ts
const SHORTCUTS: [string, string][] = [
  ["Alt+Shift+L", "curtain in / out (pre-show only)"],
  ["Space", "unveil · then full screen"],
  ["Alt+O", "this panel"],
  ["Alt+A", "arm / lock"],
  ["Alt+S", "test sound"],
  ["Alt+F", "fullscreen"],
  ["Alt+R", "reset · curtain out from pre-show"],
  ["Alt+1..7", "jump to a beat"],
];
```

In the doc comment, replace "a QR pointing nowhere, a muted stage, a projector that went to sleep" with "a muted stage, a projector that went to sleep, fonts still loading".

- [ ] **Step 5: Confirm nothing imports the deleted modules**

Run: `grep -rn "ceremony-showcase\|launch-screen\|browser-reveal\|qr-card\|showcase-panel\|title-card" src tests`
Expected: no output.

---

### Task 4: The hook

**Files:**
- Modify: `src/components/launch/use-ceremony.ts`

**Interfaces:**
- Produces: `useCeremony({ onDismiss }: { onDismiss: () => void })` returning `{ status, arm, trigger, reset, jump }` as before. Alt+R in PRESHOW calls `onDismiss()`; elsewhere `reset()`. Alt+1…7 jump through `CEREMONY_ORDER`.

- [ ] **Step 1: Change the signature and the reset semantics**

Imports become:

```ts
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  INITIAL_CEREMONY,
  ceremonyReducer,
  type CeremonyStatus,
} from "@/lib/ceremony-machine";
import {
  CEREMONY_ORDER,
  CEREMONY_TIMING,
  COUNT_IN_STEP_MS,
  type CeremonyState,
} from "@/lib/ceremony-timing";
import { launchAudio } from "@/lib/launch-audio";
```

Signature:

```ts
export function useCeremony({
  onDismiss,
}: {
  /** Take the overlay down: Alt+R from the pre-show, where a reset means "go away". */
  onDismiss: () => void;
}): {
  status: CeremonyStatus;
  arm: (armed: boolean) => void;
  trigger: () => void;
  reset: () => void;
  jump: (to: CeremonyState) => void;
} {
  const [status, dispatch] = useReducer(ceremonyReducer, INITIAL_CEREMONY);

  // The keyboard handler is registered once and needs the current beat.
  const stateRef = useRef(status.state);
  useEffect(() => {
    stateRef.current = status.state;
  }, [status.state]);
```

Sound cues:

```ts
  useEffect(() => {
    if (status.state === "PARTING") launchAudio.playCurtainSweep();
    if (status.state === "CELEBRATING") launchAudio.playLaunchFanfare();
    // The curtain moves again — out, this time — so it makes its noise again.
    if (status.state === "GROW") launchAudio.playCurtainSweep();
  }, [status.state]);
```

Timed-state comment: "PRESHOW, HOLD and OFF have a null duration and wait for a person instead." Keyboard block: delete the local `BEATS` array; the comment becomes "Alt+1 to Alt+7 jump to a beat"; the Alt+R branch and the jump lookup become:

```ts
      if (e.key.toLowerCase() === "r") {
        // From the pre-show, a reset is the operator saying "take it down".
        if (stateRef.current === "PRESHOW") onDismiss();
        else reset();
        return;
      }

      const beat = CEREMONY_ORDER[Number(e.key) - 1];
      if (beat) jump(beat);
```

and the effect's dependency list becomes `[trigger, reset, jump, onDismiss]`.

- [ ] **Step 2: Typecheck this file**

Run: `npx tsc --noEmit -p . 2>&1 | grep use-ceremony`
Expected: no lines.

---

### Task 5: The stage screen

**Files:**
- Create: `src/components/launch/stage-screen.tsx`

**Interfaces:**
- Produces: `SCREEN_W` (string), `ScreenBox { x: number; y: number; k: number; radius: number }`, `StageScreen({ mark, lit, leaving, onBox })`. `onBox` must be referentially stable (the parent wraps it in `useCallback`).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The screen's width: as wide as the opening allows. Height is what binds on
 * a wide projector — the valance takes the top 28vh of the frame, the stage
 * is padded to it, and a 16:9 frame that used every remaining pixel ran to
 * the floor. 104vh of width is 58.5vh of height, which leaves the frame a
 * little air beneath it on any screen wider than 16:9.
 */
export const SCREEN_W = "min(84vw, 124vmin, 104vh)";

/** Where the screen is, for the page to be placed into it. */
export interface ScreenBox {
  /** Viewport offset of the box's top-left corner, in px. */
  x: number;
  y: number;
  /** Box width over viewport width: the scale that fits a viewport into it. */
  k: number;
  /** The box's corner radius in the page's own (unscaled) px. */
  radius: number;
}

/**
 * The screen on the stage — the frame, not the picture.
 *
 * The picture is the real home page, scaled into this box by `Ceremony`, one
 * layer below the overlay. This component draws what surrounds it: a hairline
 * of ivory for the bezel and a deep throw of shadow, so it stands in the
 * opening as an object rather than a rectangle drawn on the cloth; a dark
 * panel over it until the light-up; a breath of gloss on the glass.
 *
 * It reports its own box, measured, because the page below has to be moved
 * to exactly here, and CSS cannot hand one element's rectangle to another.
 */
export function StageScreen({
  mark,
  lit,
  leaving,
  onBox,
}: {
  /** The association's mark, faint on the dark glass while it stands by. */
  mark: string;
  /** True once the page should show on the glass. */
  lit: boolean;
  /** True while the page grows to full screen: the frame fades away. */
  leaving: boolean;
  onBox: (box: ScreenBox) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const k = r.width / window.innerWidth;
      onBox({
        x: r.left,
        y: r.top,
        k,
        // 0.7vmin, in the page's px: the page is scaled by k, so its radius
        // has to be divided by k to land at 0.7vmin on screen.
        radius: (Math.min(window.innerWidth, window.innerHeight) * 0.007) / k,
      });
    };
    // A ResizeObserver reports once on observe, so the first measurement
    // arrives before paint without a synchronous call here.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [onBox]);

  return (
    <motion.div
      ref={ref}
      className="relative max-w-full rounded-[0.7vmin]"
      style={{
        width: SCREEN_W,
        aspectRatio: "16 / 9",
        boxShadow:
          "0 3vmin 8vmin -2vmin rgba(0,0,0,0.95), inset 0 0 0 0.16vmin rgba(246,238,224,0.2)",
      }}
      initial={false}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {/* Standing by: dark glass with a little light on it, and the mark
          faint behind it. Lifts to show the page beneath. */}
      <motion.div
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-[0.7vmin]"
        style={{ backgroundColor: "#090607" }}
        initial={false}
        animate={{ opacity: lit ? 0 : 1 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 28% 0%, rgba(255,255,255,0.07), transparent 62%)",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mark}
          alt=""
          className="absolute left-1/2 top-1/2 h-[22%] w-auto -translate-x-1/2 -translate-y-1/2"
          style={{ opacity: 0.11, filter: "grayscale(1)" }}
        />
      </motion.div>

      {/* A breath of gloss over whatever is on the glass. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[0.7vmin]"
        style={{
          background:
            "linear-gradient(170deg, rgba(255,255,255,0.05) 0%, transparent 34%, transparent 82%, rgba(0,0,0,0.18) 100%)",
        }}
      />
    </motion.div>
  );
}
```

- [ ] **Step 2: Typecheck this file**

Run: `npx tsc --noEmit -p . 2>&1 | grep stage-screen`
Expected: no lines.

---

### Task 6: The overlay and the curtain

**Files:**
- Create: `src/components/launch/ceremony-overlay.tsx`
- Delete: `src/components/launch/launch-ceremony.tsx`
- Modify: `src/components/launch/curtain.tsx` (`Curtain` export, ~line 1270)

**Interfaces:**
- Consumes: `useCeremony({ onDismiss })`, `StageScreen`, `ScreenBox`, `LIGHT_UP_HOLD_MS`.
- Produces: `CeremonyOverlay({ config, onState, onBox, onDismiss })`; `onState` is called with every beat including `"OFF"`.

- [ ] **Step 1: Update the curtain for the new beat names**

In `curtain.tsx`, the `Curtain` export's `gone` line becomes:

```ts
  // Full screen: the legs run the rest of the way into the wings and the
  // valance flies. The curtain stays mounted, so the operator's jump back to
  // any earlier beat brings it in again rather than remounting it.
  const gone = state === "GROW" || state === "OFF";
```

and every `CINEMA_MS` in the file becomes `GROW_MS` (the import line included).

- [ ] **Step 2: Write the overlay**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ConfettiCanvas } from "./confetti-canvas";
import { CountIn } from "./count-in";
import { Curtain } from "./curtain";
import { FireworksCanvas } from "./fireworks-canvas";
import { OperatorBar } from "./operator-bar";
import { PreShow } from "./pre-show";
import { StageScreen, type ScreenBox } from "./stage-screen";
import { useCeremony } from "./use-ceremony";
import { LIGHT_UP_HOLD_MS, type CeremonyState } from "@/lib/ceremony-timing";
import type { SiteConfig } from "@/lib/config-schema";

/**
 * The house, above the page.
 *
 *   z-12   STAGE — the screen's frame; the page shows through it from below
 *   z-13   fireworks — over the screen, under the cloth
 *   z-15   the curtain: two legs and the valance, mounted all evening
 *   z-20   FRONT — pre-show and count-in, in front of the closed cloth
 *   z-50   confetti, and the operator's panel
 *
 * The page itself is not in here. `Ceremony` holds it one layer below and
 * scales it into the screen's box; this overlay is what stands around it.
 * The house floor and its atmosphere are below the page too, so the
 * vignette darkens the floor and never the picture.
 *
 * The opening: the part of the frame the cloth does not cover once the
 * curtain is drawn. Below the valance's fringe at the bellies of the swags
 * (about 28vh on a landscape screen, 21vh on a phone), and inside the two
 * bunched legs (each 54% of the width scaled to 15%, so 8.1% a side). The
 * effects are boxed to this, so a shell never bursts across velvet.
 */
const OPENING =
  "pointer-events-none absolute bottom-0 left-[8.2%] right-[8.2%] top-[22vh] overflow-hidden sm:top-[29vh]";

const LIT: CeremonyState[] = ["CELEBRATING", "HOLD", "GROW", "OFF"];

export function CeremonyOverlay({
  config,
  onState,
  onBox,
  onDismiss,
}: {
  config: SiteConfig;
  /** Every beat as it happens, OFF included — the wrapper moves the page by it. */
  onState: (state: CeremonyState) => void;
  /** Where the screen is, so the wrapper can put the page there. */
  onBox: (box: ScreenBox) => void;
  /** Take the overlay down from the pre-show. */
  onDismiss: () => void;
}) {
  const { status, arm, reset } = useCeremony({ onDismiss });
  const { state } = status;

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  // The light-up holds the screen dark for a beat after the curtain settles,
  // then lifts. Clocked with rAF and gated on the beat, so a stale reading
  // cannot show through and nothing is set from an effect body.
  const lightingUp = state === "LIGHT_UP";
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!lightingUp) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setElapsed(now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lightingUp]);

  const lit = LIT.includes(state) || (lightingUp && elapsed >= LIGHT_UP_HOLD_MS);
  const celebrating = state === "CELEBRATING";
  const growing = state === "GROW";
  const sparks = celebrating || state === "HOLD" || growing;

  const mark = config.branding.logoUrl || "/images/logo.png";
  const stableBox = useCallback((box: ScreenBox) => onBox(box), [onBox]);

  return (
    <motion.div
      className="fixed inset-0 z-[210] overflow-hidden text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* STAGE — the screen's frame. Mounted from the first beat so its box
          is known before the curtain moves; the closed cloth hides it. */}
      <div className="absolute inset-0 z-[12] flex items-center justify-center overflow-hidden px-[9vw] pb-[4vh] pt-[21vh] sm:pt-[28vh]">
        <StageScreen mark={mark} lit={lit} leaving={growing} onBox={stableBox} />
      </div>

      <Curtain state={state} />

      {/* Both effects are clipped to the OPENING — below the valance's fringe,
          between the two bunched legs — so nothing is ever thrown across the
          cloth. The fireworks do not stop: they carry the celebration and
          keep going, quieter, while the picture is held, until the grow,
          when no more are launched and the ones in the air burn out. */}
      <motion.div
        aria-hidden
        className={OPENING + " z-[13]"}
        animate={{ opacity: growing ? 0 : 1 }}
        transition={{ duration: 0.9 }}
      >
        <FireworksCanvas active={sparks} intensity={celebrating ? 1 : growing ? 0 : 0.35} />
      </motion.div>
      <div aria-hidden className={OPENING + " z-50"}>
        <ConfettiCanvas active={celebrating} originX={0.5} originY={0.35} />
      </div>

      {/* FRONT — in front of the closed cloth. Padded so the block centres on
          the opening below the valance's hem and sits a touch above that
          centre, where the eye expects a thing to hang. */}
      <div className="relative z-20 flex h-svh flex-col items-center justify-center pt-[14vh] text-center sm:pt-[20vh]">
        {state === "PRESHOW" && <PreShow config={config} />}
        {state === "COUNT_IN" && <CountIn count={status.count} />}
      </div>

      <OperatorBar state={state} armed={status.armed} onArm={arm} onReset={reset} />
    </motion.div>
  );
}
```

- [ ] **Step 3: Delete the old page component**

```bash
git rm -q src/components/launch/launch-ceremony.tsx
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v "ceremony.tsx\|layout.tsx"`
Expected: no lines (the two named files are Task 7's).

---

### Task 7: The wrapper, the layout, and the cookie banner

**Files:**
- Create: `src/lib/ceremony-event.ts`
- Create: `src/components/launch/ceremony.tsx`
- Modify: `src/app/(public)/layout.tsx`
- Modify: `src/components/legal/cookie-consent.tsx`

**Interfaces:**
- Consumes: `CeremonyOverlay`, `ScreenBox`, `GROW_MS`, `CeremonyState`.
- Produces: `CEREMONY_EVENT = "ksa:ceremony"` dispatched on `window` with `detail: { active: boolean }`; `Ceremony({ enabled, config, children })`.

- [ ] **Step 1: The event name**

`src/lib/ceremony-event.ts`:

```ts
/**
 * Fired on `window` when the launch ceremony's overlay goes up or comes down,
 * with `detail.active`. Anything that would otherwise sit on top of the stage
 * — the cookie banner — listens for it. Its own module so the listener does
 * not import the ceremony.
 */
export const CEREMONY_EVENT = "ksa:ceremony";
```

- [ ] **Step 2: The wrapper**

`src/components/launch/ceremony.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CEREMONY_EVENT } from "@/lib/ceremony-event";
import { GROW_MS, type CeremonyState } from "@/lib/ceremony-timing";
import type { SiteConfig } from "@/lib/config-schema";
import type { ScreenBox } from "./stage-screen";

// Loaded on the chord, never before: an ordinary visit downloads none of it.
const CeremonyOverlay = dynamic(
  () => import("./ceremony-overlay").then((m) => m.CeremonyOverlay),
  { ssr: false }
);

/** The grow: slow to leave, slow to land, like a camera dolly. */
const GROW_EASE = [0.6, 0, 0.2, 1] as const;

/**
 * How long the house takes to fade in over the page before the page is
 * moved. The overlay's own fade is 600ms; the page is scaled a beat after
 * it is fully covered, so nobody sees the site shrink.
 */
const RAISE_MS = 700;

const HOUSE = "hsl(350 10% 7%)";

/**
 * The launch ceremony, as a layer over the home page.
 *
 * This wraps the page tree in the public layout and, most of the time, is one
 * `div` doing nothing. With the switch on, it listens for Alt+Shift+L. On the
 * chord the overlay is loaded and fades in over the page; a beat later the
 * page — the real one, navbar, hero video and all — is scaled by one CSS
 * transform into the screen box the overlay draws on its stage, clipped to a
 * viewport's worth so the screen shows exactly the projector's first screen
 * of the site. The curtain draws on that. At the end the same transform runs
 * back to identity over the grow, the overlay is unmounted, and what is left
 * is the plain page, untouched and scrollable.
 *
 * The page is never remounted: the children stay in the same element and
 * only its class and transform change, so the hero video keeps playing
 * through the reveal and nothing on the page loses its state.
 *
 * While the curtain is closed the page's videos are paused. Nobody can see
 * them and decoding them under an SVG-filtered curtain is what made the
 * old page stutter. They resume as the curtain starts to move.
 */
export function Ceremony({
  enabled,
  config,
  children,
}: {
  enabled: boolean;
  config: SiteConfig;
  children: React.ReactNode;
}) {
  const reduced = Boolean(useReducedMotion());
  const [summoned, setSummoned] = useState(false);
  const [raised, setRaised] = useState(false);
  const [state, setState] = useState<CeremonyState>("PRESHOW");
  const [box, setBox] = useState<ScreenBox | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<CeremonyState>("PRESHOW");

  const dismiss = useCallback(() => {
    setSummoned(false);
    setRaised(false);
    setBox(null);
    setState("PRESHOW");
    stateRef.current = "PRESHOW";
  }, []);

  const onState = useCallback(
    (s: CeremonyState) => {
      stateRef.current = s;
      setState(s);
      // OFF is the overlay being gone. The grow has landed by now — its
      // timer and the transform share one duration — so removing the
      // transform here changes nothing the eye can see.
      if (s === "OFF") dismiss();
    },
    [dismiss]
  );

  // The chord. Only ever registered when the switch is on.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.altKey && e.shiftKey && e.code === "KeyL")) return;
      e.preventDefault();
      if (!summoned) setSummoned(true);
      else if (stateRef.current === "PRESHOW") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, summoned, dismiss]);

  // The house comes up first; the page is moved once it is covered.
  useEffect(() => {
    if (!summoned) return;
    const id = setTimeout(() => setRaised(true), RAISE_MS);
    return () => clearTimeout(id);
  }, [summoned]);

  // Scroll lock, pinned at the top, and the word to anything that would
  // otherwise sit over the stage. Both undone when the overlay comes down.
  useEffect(() => {
    if (!summoned) return;
    const html = document.documentElement;
    const previous = html.style.overflow;
    window.scrollTo(0, 0);
    html.style.overflow = "hidden";
    window.dispatchEvent(new CustomEvent(CEREMONY_EVENT, { detail: { active: true } }));
    return () => {
      html.style.overflow = previous;
      window.dispatchEvent(new CustomEvent(CEREMONY_EVENT, { detail: { active: false } }));
    };
  }, [summoned]);

  // Videos rest while the curtain is closed. Only the ones that were playing
  // are resumed, so a video the visitor had paused stays paused.
  const closed = summoned && (state === "PRESHOW" || state === "COUNT_IN");
  useEffect(() => {
    if (!closed) return;
    const playing = Array.from(pageRef.current?.querySelectorAll("video") ?? []).filter(
      (v) => !v.paused
    );
    playing.forEach((v) => v.pause());
    return () => {
      playing.forEach((v) => {
        void v.play().catch(() => {});
      });
    };
  }, [closed]);

  const staged = summoned && raised && box !== null;
  const growing = state === "GROW";
  const target =
    staged && !growing
      ? { x: box.x, y: box.y, scale: box.k }
      : { x: 0, y: 0, scale: 1 };
  const transition = growing
    ? { duration: reduced ? 0.3 : GROW_MS / 1000, ease: GROW_EASE }
    : { duration: 0 };

  return (
    <>
      {/* The house floor, under the page: the stage's near-black, the warm
          wash, the vignette and the grain. Static, never animated — this has
          to hold 60fps on whatever machine is driving the projector. Under
          the page rather than over it so the vignette darkens the floor and
          never the picture on the screen. */}
      {summoned && (
        <div aria-hidden className="fixed inset-0 z-[200]" style={{ backgroundColor: HOUSE }}>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 62% 50% at 50% 44%, hsl(352 55% 32% / 0.2) 0%, hsl(352 50% 22% / 0.08) 45%, transparent 74%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 65% at 50% 50%, transparent 0%, rgba(0,0,0,0.62) 100%)",
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
      )}

      {/* The page. Ordinarily a plain div; on stage, a fixed viewport-sized
          box clipped to one screen's worth and scaled into the screen. The
          navbar and the top loader are `fixed`, and inside a transformed
          ancestor `fixed` means fixed to that ancestor — which is exactly
          what puts them on the little screen, and exactly what lets them go
          when the transform is removed. */}
      <motion.div
        ref={pageRef}
        className={staged ? "fixed inset-0 z-[205] h-screen w-screen overflow-hidden" : undefined}
        style={{
          transformOrigin: "0 0",
          borderRadius: staged && !growing && box ? box.radius : 0,
          willChange: growing ? "transform" : undefined,
        }}
        initial={false}
        animate={target}
        transition={transition}
      >
        {children}
      </motion.div>

      {summoned && (
        <CeremonyOverlay config={config} onState={onState} onBox={setBox} onDismiss={dismiss} />
      )}
    </>
  );
}
```

- [ ] **Step 3: Wrap the page tree**

In `src/app/(public)/layout.tsx` add `import { Ceremony } from "@/components/launch/ceremony";` and change the tree to:

```tsx
          <ConsentGate>
            <Ceremony enabled={config.features.launchCeremony} config={config}>
              <div className="flex flex-col min-h-screen">
                <NextTopLoader color="hsl(var(--primary))" showSpinner={false} height={2} />
                <Navbar />
                <main className="flex-1">
                  {children}
                </main>
                <Footer />
              </div>
            </Ceremony>
            <CookieConsent />
            <WhatsAppFab />
          </ConsentGate>
```

- [ ] **Step 4: The cookie banner steps aside**

In `cookie-consent.tsx` add `import { CEREMONY_EVENT } from "@/lib/ceremony-event";` and, after the `OPEN_COOKIE_SETTINGS_EVENT` effect, add:

```ts
  // The launch ceremony's overlay is a stage in front of a hall that cannot
  // click. The banner closes when the curtain goes up and stays closed; it
  // asks again on the next real visit, since nothing was saved.
  React.useEffect(() => {
    const onCeremony = (e: Event) => {
      if ((e as CustomEvent<{ active: boolean }>).detail?.active) setOpen(false);
    };
    window.addEventListener(CEREMONY_EVENT, onCeremony);
    return () => window.removeEventListener(CEREMONY_EVENT, onCeremony);
  }, []);
```

- [ ] **Step 5: Typecheck, lint, test**

Run:
```bash
npx tsc --noEmit
npx eslint src/components/launch src/lib/ceremony-timing.ts src/lib/ceremony-machine.ts src/lib/ceremony-event.ts src/components/legal/cookie-consent.tsx "src/app/(public)/layout.tsx" "src/app/admin/(dashboard)/settings/settings-client.tsx" tests/launch tests/config-utils.test.ts --max-warnings=0
npx vitest run
```
Expected: tsc silent; eslint silent; all tests pass (825 minus the deleted showcase file's cases, plus the new ones).

---

### Task 8: Visual verification on a dev server

**Files:**
- Create (scratchpad, not the repo): `cdp-home.mjs`

- [ ] **Step 1: Turn the switch on for the run**

The switch lives in the DB and is set through Settings. For an automated run, `getConfig` cannot be overridden without touching content, so verify with the switch on by signing into the admin portal and flipping "Launch ceremony" in Settings → Modules on the dev database, then run the capture. Turn it back off afterwards, or leave it on if the dev DB is not the production one (`/ksadev`).

- [ ] **Step 2: Capture**

`cdp-home.mjs` (copy `cdp-cinema.mjs` from the scratchpad and change the drive):

```js
await send("Page.navigate", { url });   // http://localhost:3005/
for (let i = 0; i < 120; i++) {
  if (await evaluate("document.readyState === 'complete' && !!document.querySelector('video, main')")) break;
  await sleep(500);
}
await sleep(3000);
await key("L", "KeyL", 76, 1 | 8);      // Alt(1) + Shift(8)
await sleep(2500);
await shot("preshow");
await key("6", "Digit6", 54, 1);        // HOLD
await sleep(7000);
await shot("hold");
await key("Enter", "Enter", 13, 0);
await sleep(1300);
await shot("grow");
await sleep(2600);
await shot("off");
console.log(await evaluate(`(() => { const o = document.querySelector('.z-\\\\[210\\\\]'); const p = document.querySelector('main').parentElement.parentElement; return 'overlay=' + (o ? 'present' : 'gone') + ' page.transform=' + getComputedStyle(p).transform + ' html.overflow=' + document.documentElement.style.overflow; })()`));
```

Run at 1920×1080 and 1920×1200. Expected: `preshow` shows the closed curtain over a dark house; `hold` shows the real page scaled on the screen, no cookie banner, fireworks quiet; `grow` shows the page mid-growth with the curtain flying; `off` is the plain home page, probe prints `overlay=gone page.transform=none html.overflow=` (empty).

- [ ] **Step 3: Send the stills to Aby and report**

---

## Self-review

- Spec coverage: gate and trigger (Task 2, Task 7), where it lives (Task 7), beats (Task 1, 4, 6), screen (Task 5, 7), performance — lazy load, video pause, single transform (Task 7), operator panel (Task 3), removal and reverts (Task 3), cookie banner (Task 7), testing (Task 1, 2, 8). The spec's "GROW → OFF on LAND" is implemented as the GROW timer; noted in Global Constraints.
- Placeholders: none.
- Type consistency: `ScreenBox` fields `x, y, k, radius` used identically in Tasks 5, 6, 7; `onState`/`onBox`/`onDismiss` names match between Tasks 6 and 7; `CEREMONY_ORDER` used in Task 4 as exported from Task 1; `GROW_MS` in Tasks 1, 6 (curtain), 7.
