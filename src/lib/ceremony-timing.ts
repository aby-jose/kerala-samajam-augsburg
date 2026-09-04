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
  | "BROWSER"
  | "CELEBRATING"
  | "SHOWCASE";

/** The beats, in the order they run. The rehearsal jump keys index this. */
export const CEREMONY_ORDER: CeremonyState[] = [
  "PRESHOW",
  "COUNT_IN",
  "PARTING",
  "BROWSER",
  "CELEBRATING",
  "SHOWCASE",
];

/** The count-in starts here and steps down to 1, then the curtain moves. */
export const COUNT_IN_FROM = 10;
export const COUNT_IN_STEP_MS = 900;
export const PARTING_MS = 2800;

/**
 * The browser beat: a cursor crosses to the address bar, clicks, types the
 * address a character at a time, and hits Go. Broken out so the typing can be
 * paced against it rather than guessed.
 */
export const BROWSER_CURSOR_MS = 1300;
export const BROWSER_TYPE_MS = 2600;
export const BROWSER_SUBMIT_MS = 900;
export const BROWSER_MS =
  BROWSER_CURSOR_MS + BROWSER_TYPE_MS + BROWSER_SUBMIT_MS + 700;

export const CELEBRATING_MS = 6000;

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
  BROWSER: BROWSER_MS,
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
