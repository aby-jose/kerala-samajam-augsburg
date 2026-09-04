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
