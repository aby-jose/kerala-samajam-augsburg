"use client";

import { Container } from "@/components/layout/container";
import { ConfettiCanvas } from "./confetti-canvas";
import { CountIn } from "./count-in";
import { Curtain } from "./curtain";
import { PreShow } from "./pre-show";
import { TitleCard } from "./title-card";
import { useCeremony } from "./use-ceremony";
import type { SiteConfig } from "@/lib/config-schema";

/**
 * The stage.
 *
 * Deliberately thin: `useCeremony` owns behaviour and each beat owns its own
 * appearance. Composition roots that also own layout, QR generation, audio and
 * operator controls are how the draft version of this page reached 406 lines
 * and became impossible to rehearse one beat at a time.
 */
export function LaunchCeremony({ config }: { config: SiteConfig }) {
  const { status, arm, trigger, reset } = useCeremony();

  return (
    <div className="relative min-h-svh w-full overflow-hidden bg-[hsl(0_0%_6%)] text-white">
      <Curtain state={status.state} />
      <ConfettiCanvas active={status.state === "CELEBRATING"} originX={0.5} originY={0.45} />

      {/* Stage atmosphere — the same vignette and film grain the home page hero
          uses, so the ceremony reads as the same production as the site it is
          unveiling. Static, never animated: Lighthouse flags animated filters
          as non-composited, and this has to hold a steady 60fps on whatever
          machine is driving the projector. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 65% at 50% 50%, transparent 0%, rgba(0,0,0,0.6) 100%)",
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

      <Container className="relative z-20 flex min-h-svh flex-col items-center justify-center gap-6 text-center">
        {status.state === "PRESHOW" && (
          <PreShow config={config} armed={status.armed} onTrigger={trigger} />
        )}
        {status.state === "COUNT_IN" && <CountIn count={status.count} />}
        {(status.state === "CELEBRATING" || status.state === "SHOWCASE") && (
          <TitleCard config={config} />
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <button
            onClick={() => arm(!status.armed)}
            className="rounded-xl border border-white/15 px-4 py-2"
          >
            {status.armed ? "Locked stage: armed" : "Locked stage: locked"}
          </button>
          <button
            onClick={trigger}
            className="rounded-xl bg-primary px-4 py-2 font-semibold"
          >
            Trigger
          </button>
          <button
            onClick={reset}
            className="rounded-xl border border-white/15 px-4 py-2"
          >
            Reset
          </button>
        </div>

        <p className="text-xs text-white/40">
          Space to trigger • 1-5 to jump to a beat • R to reset
        </p>
      </Container>
    </div>
  );
}
