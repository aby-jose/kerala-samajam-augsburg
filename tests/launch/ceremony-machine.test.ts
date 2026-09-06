import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  INITIAL_CEREMONY,
  ceremonyReducer,
  type CeremonyStatus,
} from "@/lib/ceremony-machine";
import { CEREMONY_ORDER, CEREMONY_TIMING, ceremonyAt, COUNT_IN_FROM } from "@/lib/ceremony-timing";

const armed: CeremonyStatus = { ...INITIAL_CEREMONY, armed: true };

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

  it("keeps the fireworks over the full-screen site after the grow, then switches off", () => {
    let s: CeremonyStatus = { ...armed, state: "GROW" };
    s = ceremonyReducer(s, { type: "ADVANCE" });
    expect(s.state).toBe("AFTERGLOW");
    s = ceremonyReducer(s, { type: "ADVANCE" });
    expect(s.state).toBe("OFF");
  });

  it("ignores every press once off", () => {
    const s: CeremonyStatus = { ...armed, state: "OFF" };
    expect(ceremonyReducer(s, { type: "TRIGGER" })).toEqual(s);
    expect(ceremonyReducer(s, { type: "ADVANCE" })).toEqual(s);
  });

  it("lists the eight visible beats in running order, without OFF", () => {
    expect(CEREMONY_ORDER).toEqual([
      "PRESHOW", "COUNT_IN", "PARTING", "LIGHT_UP", "CELEBRATING", "HOLD", "GROW", "AFTERGLOW",
    ]);
  });

  it("counts in from five", () => {
    expect(COUNT_IN_FROM).toBe(5);
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

  it("gives every timed beat a positive duration, since they advance on their own", () => {
    expect(CEREMONY_TIMING.COUNT_IN).toBeGreaterThan(0);
    expect(CEREMONY_TIMING.PARTING).toBeGreaterThan(0);
    expect(CEREMONY_TIMING.LIGHT_UP).toBeGreaterThan(0);
    expect(CEREMONY_TIMING.CELEBRATING).toBeGreaterThan(0);
    expect(CEREMONY_TIMING.GROW).toBeGreaterThan(0);
    expect(CEREMONY_TIMING.AFTERGLOW).toBe(5000);
  });
});

describe("ceremonyAt", () => {
  const ENV_KEY = "NEXT_PUBLIC_CEREMONY_AT";
  let originalValue: string | undefined;

  beforeEach(() => {
    originalValue = process.env[ENV_KEY];
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalValue;
    }
  });

  it("returns null when NEXT_PUBLIC_CEREMONY_AT is unset", () => {
    delete process.env[ENV_KEY];
    expect(ceremonyAt()).toBeNull();
  });

  it("returns null when NEXT_PUBLIC_CEREMONY_AT is unparseable garbage", () => {
    process.env[ENV_KEY] = "not-a-date";
    expect(ceremonyAt()).toBeNull();
  });

  it("returns a Date when NEXT_PUBLIC_CEREMONY_AT is a valid ISO 8601 string with an offset", () => {
    process.env[ENV_KEY] = "2026-09-20T18:00:00+02:00";
    const result = ceremonyAt();
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe("2026-09-20T16:00:00.000Z");
  });
});
