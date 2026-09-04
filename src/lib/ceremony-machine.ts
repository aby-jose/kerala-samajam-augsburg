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
 * What each timed beat hands over to.
 *
 * COUNT_IN is absent on purpose: it advances a numeral at a time through TICK,
 * and only the last tick moves the state on. PRESHOW and SHOWCASE are absent
 * because they wait for a person.
 */
const NEXT: Partial<Record<CeremonyState, CeremonyState>> = {
  PARTING: "BROWSER",
  BROWSER: "CELEBRATING",
  CELEBRATING: "SHOWCASE",
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

    case "ADVANCE": {
      const next = NEXT[status.state];
      return next ? { ...status, state: next } : status;
    }

    case "RESET":
      // Deliberately drops `armed`. Rehearsing then walking away must not
      // leave a live stage one stray spacebar from firing.
      return INITIAL_CEREMONY;

    case "JUMP":
      // A jump that lands on PRESHOW re-locks, for the same reason RESET does.
      return {
        ...status,
        state: action.to,
        count: COUNT_IN_FROM,
        armed: action.to === "PRESHOW" ? false : status.armed,
      };

    default:
      return status;
  }
}
