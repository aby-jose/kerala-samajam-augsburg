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
 *   AFTERGLOW    the site full screen, fireworks still over it, for a while
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
  | "AFTERGLOW"
  | "OFF";

/**
 * The visible beats, in the order they run. The rehearsal jump keys index
 * this: Alt+1 is PRESHOW, Alt+8 is AFTERGLOW. OFF is not a place to jump to
 * — it is the overlay being gone.
 */
export const CEREMONY_ORDER: CeremonyState[] = [
  "PRESHOW",
  "COUNT_IN",
  "PARTING",
  "LIGHT_UP",
  "CELEBRATING",
  "HOLD",
  "GROW",
  "AFTERGLOW",
];

/**
 * The count-in starts here and steps down to 1, then the curtain moves.
 * Five, a second apart: long enough for a hall to join in.
 */
export const COUNT_IN_FROM = 5;
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
 * The light-up, in three movements on the dark glass:
 *
 *   1. the address types itself across the screen, and holds with its caret
 *      blinking, so the hall reads it;
 *   2. the address travels down to its place beneath the screen, and the
 *      caption — code and cue — comes up around it;
 *   3. the page lights on the glass, and settles before the celebration.
 *
 * The typing BEGINS BEFORE THE DRAW HAS FINISHED, by `TYPE_LEAD_MS`. The
 * draw's last second is the curtain settling, nearly still, and typing that
 * waited for it read as a pause nobody had asked for; the glass is clear of
 * the legs well before they stop, so the first letters land on it while the
 * cloth is still coming to rest. LIGHT_UP's own length is shortened by the
 * same lead so the whole runs to the same clock.
 *
 * `TYPE_MS` is the whole address, however long it is — a longer address
 * types faster rather than holding the hall longer. On a deployment with no
 * public address there is nothing to type, and the screen simply holds dark
 * for `LIGHT_UP_HOLD_MS` before the page shows.
 */
export const TYPE_LEAD_MS = 700;
export const TYPE_MS = 2000;
export const TYPE_HOLD_MS = 700;
export const ADDRESS_MOVE_MS = 1400;
export const LIGHT_UP_HOLD_MS = 1400;
export const LIGHT_UP_MS = TYPE_MS + TYPE_HOLD_MS + ADDRESS_MOVE_MS + 1400 - TYPE_LEAD_MS;

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
 * The afterglow: the site is full screen and the fireworks carry on over it
 * before the overlay finally goes. The last quarter of it is the fade.
 */
export const AFTERGLOW_MS = 5000;

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
  AFTERGLOW: AFTERGLOW_MS,
  OFF: null,
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
