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
