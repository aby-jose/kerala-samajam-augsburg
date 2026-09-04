"use client";

import { Container } from "@/components/layout/container";
import { ConfettiCanvas } from "./confetti-canvas";
import { CountIn } from "./count-in";
import { Curtain } from "./curtain";
import { OperatorBar } from "./operator-bar";
import { PreShow } from "./pre-show";
import { ShowcasePanel } from "./showcase-panel";
import { TitleCard } from "./title-card";
import { useCeremony } from "./use-ceremony";
import type { QrTarget } from "@/lib/ceremony-showcase";
import type { SiteConfig } from "@/lib/config-schema";

/**
 * The stage.
 *
 * Deliberately thin: `useCeremony` owns behaviour and each beat owns its own
 * appearance. Composition roots that also own layout, QR generation, audio and
 * operator controls are how the draft version of this page reached 406 lines
 * and became impossible to rehearse one beat at a time.
 *
 * `qr` is resolved on the server in `app/launch/page.tsx` and passed in, rather
 * than computed here: the environment variable behind it is server-only.
 */
export function LaunchCeremony({
  config,
  qr,
}: {
  config: SiteConfig;
  qr: QrTarget;
}) {
  const { status, arm, trigger, reset } = useCeremony();

  return (
    // `overflow-x-hidden`, not `overflow-hidden`: on a 1024x768 hall projector
    // the showcase QR panel is taller than the viewport, and clipping it is
    // worse than letting it scroll.
    // The ground is a barely-warm near-black rather than a neutral one: it
    // carries the curtain's crimson hue at a tenth of its saturation, so the
    // stage reads as a dark theatre with the house lights down instead of a
    // generic dark web page.
    <div className="relative min-h-svh w-full overflow-x-hidden bg-[hsl(346_10%_7%)] text-white">
      <Curtain state={status.state} />
      <ConfettiCanvas active={status.state === "CELEBRATING"} originX={0.5} originY={0.45} />

      {/* Stage atmosphere — the same vignette and film grain the home page hero
          uses, so the ceremony reads as the same production as the site it is
          unveiling. Static, never animated: Lighthouse flags animated filters
          as non-composited, and this has to hold a steady 60fps on whatever
          machine is driving the projector. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
        {/* The wash — a low pool of warm light on the stage, sitting under the
            vignette so the vignette still closes the corners down. It is a
            single static radial gradient for the same reason as everything
            else in this block: a moving light would be lovely and would cost
            the frame budget the projector does not have. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 62% 50% at 50% 44%, hsl(346 60% 34% / 0.22) 0%, hsl(346 55% 24% / 0.09) 45%, transparent 74%)",
          }}
        />
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
        {status.state === "CELEBRATING" && <TitleCard config={config} />}
        {status.state === "SHOWCASE" && <ShowcasePanel config={config} qr={qr} />}
      </Container>

      <OperatorBar
        state={status.state}
        armed={status.armed}
        qr={qr}
        onArm={arm}
        onReset={reset}
      />
    </div>
  );
}
