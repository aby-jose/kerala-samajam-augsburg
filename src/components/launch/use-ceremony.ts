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
