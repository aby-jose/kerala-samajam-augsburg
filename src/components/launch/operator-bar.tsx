"use client";

import { useCallback, useEffect, useState } from "react";
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

const SHORTCUTS: [string, string][] = [
  ["Alt+Shift+L", "curtain in / out (pre-show only)"],
  ["Space", "unveil · then full screen"],
  ["Alt+O", "this panel"],
  ["Alt+A", "arm / lock"],
  ["Alt+S", "test sound"],
  ["Alt+F", "fullscreen"],
  ["Alt+R", "reset · curtain out from pre-show"],
  ["Alt+1..8", "jump to a beat"],
];

function Shortcut({ keys, action }: { keys: string; action: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <kbd className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-sans text-[11px] font-semibold text-white/70">
        {keys}
      </kbd>
      <span className="text-white/40">{action}</span>
    </span>
  );
}

/**
 * Operator-only, and invisible until asked for.
 *
 * This is a projector in a hall, not a workstation: nothing that is not the
 * ceremony belongs on the screen at any beat, so the panel renders nothing by
 * default and every control it offers has a keystroke. Alt+O brings it back
 * when the operator actually needs to look at something.
 *
 * The pre-flight row is the most valuable thing on this page. Every item on it
 * is a failure that is otherwise completely silent until the moment it ruins:
 * a muted stage, a projector that went to sleep, fonts still loading. So the
 * panel is worth opening once, before the hall fills up, and then dismissing.
 *
 * The keyboard handlers live here rather than in `use-ceremony` because this
 * component owns these actions — audio unlock, fullscreen, arming — and it is
 * mounted at every state.
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
  const [visible, setVisible] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    void document.fonts?.ready.then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // `unlock()` first, every time: a test tone that plays because the operator
  // clicked is worthless if the gesture did not also buy us the audio context
  // the fanfare needs later.
  const testSound = useCallback(() => {
    launchAudio.unlock();
    launchAudio.playTestTone();
    setAudioUnlocked(true);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  // Everything is behind ALT, matching the rehearsal keys in `use-ceremony`:
  // a stray unmodified letter mid-ceremony must never change what the hall is
  // looking at. Keyed off `e.code` so a non-US keyboard layout — or macOS,
  // where Alt+O types "ø" — still reaches the right action.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (!e.altKey) return;

      switch (e.code) {
        case "KeyO":
          e.preventDefault();
          setVisible((v) => !v);
          break;
        case "KeyA":
          e.preventDefault();
          onArm(!armed);
          break;
        case "KeyS":
          e.preventDefault();
          testSound();
          break;
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [armed, onArm, testSound, toggleFullscreen]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/70 px-6 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-2.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="font-semibold uppercase tracking-[0.18em] text-white/35">
              Pre-flight
            </span>
            <Check ok={audioUnlocked} label={audioUnlocked ? "Audio ready" : "Audio not tested"} />
            <Check ok={fullscreen} label={fullscreen ? "Fullscreen" : "Not fullscreen"} />
            <Check ok={fontsReady} label={fontsReady ? "Fonts loaded" : "Fonts loading"} />
            <span className="text-white/35">Beat: {state}</span>
          </div>

          {/* `blur()` on every one of these: a button that keeps focus swallows
              the spacebar, and the spacebar is how the ceremony starts. */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                testSound();
                e.currentTarget.blur();
              }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-white/70 hover:text-white"
            >
              Test sound
            </button>
            <button
              onClick={(e) => {
                toggleFullscreen();
                e.currentTarget.blur();
              }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-white/70 hover:text-white"
            >
              Fullscreen
            </button>
            <button
              onClick={(e) => {
                onReset();
                e.currentTarget.blur();
              }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-white/70 hover:text-white"
            >
              Reset
            </button>
            <button
              onClick={(e) => {
                onArm(!armed);
                e.currentTarget.blur();
              }}
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

        {/* Self-documenting: once the panel is hidden, this list is the only
            record of how to get it back. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/10 pt-2.5">
          {SHORTCUTS.map(([keys, action]) => (
            <Shortcut key={keys} keys={keys} action={action} />
          ))}
        </div>
      </div>
    </div>
  );
}
