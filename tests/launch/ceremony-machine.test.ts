import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  INITIAL_CEREMONY,
  ceremonyReducer,
  type CeremonyStatus,
} from "@/lib/ceremony-machine";
import { CEREMONY_TIMING, ceremonyAt, COUNT_IN_FROM } from "@/lib/ceremony-timing";

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

  it("keeps the stage armed when jumping to a beat that is not PRESHOW", () => {
    const s: CeremonyStatus = { ...armed, state: "SHOWCASE" };
    const next = ceremonyReducer(s, { type: "JUMP", to: "PARTING" });
    expect(next.state).toBe("PARTING");
    expect(next.armed).toBe(true);
  });

  it("re-locks the stage when jumping back to PRESHOW, matching RESET", () => {
    const s: CeremonyStatus = { ...armed, state: "SHOWCASE" };
    const next = ceremonyReducer(s, { type: "JUMP", to: "PRESHOW" });
    expect(next.state).toBe("PRESHOW");
    expect(next.armed).toBe(false);
  });

  it("leaves PRESHOW and SHOWCASE with no duration, since both wait for a person", () => {
    expect(CEREMONY_TIMING.PRESHOW).toBeNull();
    expect(CEREMONY_TIMING.SHOWCASE).toBeNull();
  });

  it("gives COUNT_IN, PARTING and CELEBRATING a positive duration, since all three advance on their own", () => {
    expect(CEREMONY_TIMING.COUNT_IN).toBeGreaterThan(0);
    expect(CEREMONY_TIMING.PARTING).toBeGreaterThan(0);
    expect(CEREMONY_TIMING.CELEBRATING).toBeGreaterThan(0);
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
