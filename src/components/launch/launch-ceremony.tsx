"use client";

import { BrowserReveal } from "./browser-reveal";
import { ConfettiCanvas } from "./confetti-canvas";
import { CountIn } from "./count-in";
import { Curtain } from "./curtain";
import { FireworksCanvas } from "./fireworks-canvas";
import { OperatorBar } from "./operator-bar";
import { PreShow } from "./pre-show";
import { ShowcasePanel } from "./showcase-panel";
import { TitleCard } from "./title-card";
import { useCeremony } from "./use-ceremony";
import { displayUrl, type QrTarget } from "@/lib/ceremony-showcase";
import type { SiteConfig } from "@/lib/config-schema";

/**
 * The house.
 *
 * Two layers of content sit either side of the curtain, because a curtain only
 * means anything if there is something behind it:
 *
 *   z-10   atmosphere — wash, vignette, grain
 *   z-11   fireworks — BEHIND the stage, so a burst never lands on the QR
 *   z-12   STAGE — address bar, title card, showcase: behind the cloth
 *   z-15   the curtain: two legs and the valance, mounted all evening
 *   z-20   FRONT — pre-show and count-in, in front of the closed cloth
 *   z-50   confetti, and the operator's panel
 *
 * So the curtain draws to uncover an address bar that was already standing
 * there, and the hall watches it be revealed rather than watching it fade in
 * onto an empty floor. The stage layer is inset to the proscenium: clear of
 * the valance above and the two legs at the sides.
 *
 * `qr` is resolved on the server in `app/launch/page.tsx` and passed in: the
 * environment variable behind it is server-only.
 */
export function LaunchCeremony({
  config,
  qr,
}: {
  config: SiteConfig;
  qr: QrTarget;
}) {
  const { status, arm, trigger, reset } = useCeremony();
  const { state } = status;

  // The bar is on stage from the moment the curtain starts to move, so it is
  // already there when the cloth clears. It only begins typing at BROWSER.
  const barOnStage = state === "PARTING" || state === "BROWSER";
  const celebrating = state === "CELEBRATING";

  return (
    // A barely-warm near-black: the curtain's red at a tenth of its saturation,
    // so the room reads as a dark theatre with the house lights down rather
    // than a generic dark page.
    <div className="relative h-svh w-full overflow-hidden bg-[hsl(350_10%_7%)] text-white">
      {/* Stage atmosphere. Static, never animated: this has to hold 60fps on
          whatever machine is driving the projector. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 62% 50% at 50% 44%, hsl(352 55% 32% / 0.2) 0%, hsl(352 50% 22% / 0.08) 45%, transparent 74%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 65% at 50% 50%, transparent 0%, rgba(0,0,0,0.62) 100%)",
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

      {/* STAGE — behind the cloth, inside the proscenium. */}
      <div className="absolute inset-0 z-[12] flex items-center justify-center overflow-y-auto px-[9vw] pb-[4vh] pt-[17vh]">
        {barOnStage && qr.ok && (
          <div className="flex w-full flex-col items-center gap-[5vmin]">
            {/* The mark stays on stage through the typing, so the beat is
                still visibly this association's and not a stray browser
                floating in a dark room. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={config.branding.logoUrl || "/images/logo.png"}
              alt=""
              aria-hidden
              className="h-[13vmin] w-auto opacity-90 drop-shadow-[0_1.5vmin_3vmin_rgba(0,0,0,0.6)]"
            />
            <BrowserReveal url={displayUrl(qr.url)} active={state === "BROWSER"} />
          </div>
        )}
        {celebrating && <TitleCard config={config} />}
        {state === "SHOWCASE" && <ShowcasePanel config={config} qr={qr} />}
      </div>

      <Curtain state={state} />

      {/* The fireworks do not stop. They carry the celebration and then keep
          going, quieter, behind the showcase, so the screen the hall is
          scanning from is never a still picture. */}
      <FireworksCanvas
        active={celebrating || state === "SHOWCASE"}
        intensity={celebrating ? 1 : 0.35}
      />
      <ConfettiCanvas active={celebrating} originX={0.5} originY={0.4} />

      {/* FRONT — in front of the closed cloth. */}
      <div className="relative z-20 flex h-svh flex-col items-center justify-center pt-[13vh] text-center">
        {state === "PRESHOW" && (
          <PreShow config={config} armed={status.armed} onTrigger={trigger} />
        )}
        {state === "COUNT_IN" && <CountIn count={status.count} />}
      </div>

      <OperatorBar
        state={state}
        armed={status.armed}
        qr={qr}
        onArm={arm}
        onReset={reset}
      />
    </div>
  );
}
