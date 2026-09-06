"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { Address } from "./address";
import { ConfettiCanvas } from "./confetti-canvas";
import { CountIn } from "./count-in";
import { Curtain } from "./curtain";
import { FireworksCanvas } from "./fireworks-canvas";
import { OperatorBar } from "./operator-bar";
import { Nameplate } from "./nameplate";
import { PreShow } from "./pre-show";
import { SCREEN_W, StageScreen, type ScreenBox } from "./stage-screen";
import { useCeremony } from "./use-ceremony";
import {
  ADDRESS_MOVE_MS,
  AFTERGLOW_MS,
  LIGHT_UP_HOLD_MS,
  PARTING_MS,
  TYPE_HOLD_MS,
  TYPE_LEAD_MS,
  TYPE_MS,
  type CeremonyState,
} from "@/lib/ceremony-timing";
import type { SiteConfig } from "@/lib/config-schema";

/**
 * The house, above the page.
 *
 *   z-12   STAGE — the screen's frame, the address, the code; the page shows
 *          through the frame from below
 *   z-13   fireworks — over the screen, under the cloth
 *   z-15   the curtain: two legs and the valance, mounted all evening
 *   z-20   FRONT — pre-show and count-in, in front of the closed cloth
 *   z-50   confetti, and the operator's panel
 *
 * The page itself is not in here. `Ceremony` holds it one layer below and
 * scales it into the screen's box; this overlay is what stands around it.
 * The house floor and its atmosphere are below the page too, so the
 * vignette darkens the floor and never the picture.
 *
 * The stage is laid out as a column: the screen, and beneath it the
 * nameplate — code, address, mark — the screen's own width. The address is
 * first written on the dark glass and then travels down into the plate —
 * see `Address` — so the hall reads it where it is already looking and then
 * knows where to find it for the rest of the evening.
 *
 * The opening: the part of the frame the cloth does not cover once the
 * curtain is drawn. Below the valance's fringe at the bellies of the swags
 * (about 28vh on a landscape screen, 21vh on a phone), and inside the two
 * bunched legs (each 54% of the width scaled to 15%, so 8.1% a side). The
 * effects are boxed to this, so a shell never bursts across velvet.
 */
const OPENING =
  "pointer-events-none absolute bottom-0 left-[8.2%] right-[8.2%] top-[22vh] overflow-hidden sm:top-[29vh]";

const AFTER_LIGHT_UP: CeremonyState[] = ["CELEBRATING", "HOLD", "GROW", "AFTERGLOW", "OFF"];

export function CeremonyOverlay({
  config,
  siteUrl,
  onState,
  onBox,
  onDismiss,
}: {
  config: SiteConfig;
  /** The public address for the glass, the line and the code; undefined hides all three. */
  siteUrl?: string;
  /** Every beat as it happens, OFF included — the wrapper moves the page by it. */
  onState: (state: CeremonyState) => void;
  /** Where the screen is, so the wrapper can put the page there. */
  onBox: (box: ScreenBox) => void;
  /** Take the overlay down from the pre-show. */
  onDismiss: () => void;
}) {
  const { status, arm, reset } = useCeremony({ onDismiss });
  const { state } = status;

  useEffect(() => {
    onState(state);
  }, [state, onState]);

  // The typing clock. It runs from the start of PARTING, so the typing can
  // begin in the draw's last moment (see `TYPE_LEAD_MS`), and carries on
  // through LIGHT_UP without a reset at the beat change. Any other arrival
  // in either beat — the rehearsal jump keys — starts it afresh, with the
  // typing due at once. rAF-driven and gated on the beat, so a stale reading
  // cannot show through and nothing is set from an effect body.
  const parting = state === "PARTING";
  const lightingUp = state === "LIGHT_UP";
  const clock = useRef({ start: 0, typeAt: 0, state: "" as CeremonyState | "" });
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!parting && !lightingUp) {
      clock.current.state = "";
      return;
    }
    const carried = lightingUp && clock.current.state === "PARTING";
    if (!carried) {
      clock.current = {
        start: performance.now(),
        typeAt: parting ? PARTING_MS - TYPE_LEAD_MS : 0,
        state,
      };
    } else {
      clock.current.state = state;
    }
    let raf = 0;
    const tick = (now: number) => {
      // Measured from the moment the typing is due, so it reads as the
      // typing's own time: negative while the curtain is still drawing.
      setElapsed(now - clock.current.start - clock.current.typeAt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [parting, lightingUp, state]);

  // The three movements of the light-up, as flags, on the typing clock.
  // With no address there is nothing to type and the glass simply holds
  // dark for a beat.
  const after = AFTER_LIGHT_UP.includes(state);
  const t = parting || lightingUp ? elapsed : 0;
  const typed = after ? 1 : siteUrl ? Math.max(0, t / TYPE_MS) : 0;
  const moved = after || (lightingUp && !!siteUrl && t >= TYPE_MS + TYPE_HOLD_MS);
  const lit =
    after ||
    (lightingUp &&
      (siteUrl ? t >= TYPE_MS + TYPE_HOLD_MS + ADDRESS_MOVE_MS : t >= LIGHT_UP_HOLD_MS));

  const celebrating = state === "CELEBRATING";
  const growing = state === "GROW";
  const afterglow = state === "AFTERGLOW";
  // Once the curtain has flown there is no opening to box the fireworks to:
  // they take the whole frame, over the full-screen site.
  const unboxed = growing || afterglow;

  const onGlass = (parting || lightingUp) && !!siteUrl && t >= 0 && !moved;
  const belowScreen = !!siteUrl && moved;

  const mark = config.branding.logoUrl || "/images/logo.png";
  const stableBox = useCallback((box: ScreenBox) => onBox(box), [onBox]);

  return (
    <motion.div
      className="fixed inset-0 z-[210] overflow-hidden text-white"
      initial={{ opacity: 0 }}
      // The whole house fades away over the last quarter of the afterglow,
      // fireworks and all, so the site is simply there when it has gone.
      animate={afterglow ? { opacity: [1, 1, 0] } : { opacity: 1 }}
      transition={
        afterglow
          ? { duration: AFTERGLOW_MS / 1000, times: [0, 0.72, 1], ease: "easeInOut" }
          : { duration: 0.6 }
      }
    >
      {/* STAGE — the screen, and the nameplate beneath it. Mounted from the
          first beat so the screen's box is known before the curtain moves;
          the closed cloth hides it. The plate is always in the column, at
          its full height, so nothing shifts when it shows. */}
      <LayoutGroup id="ceremony">
        <div className="absolute inset-0 z-[12] flex flex-col items-center justify-center gap-[2vh] overflow-hidden px-[9vw] pb-[4vh] pt-[21vh] sm:pt-[28vh]">
          <div className="max-w-full" style={{ width: SCREEN_W }}>
            <StageScreen mark={mark} lit={lit} leaving={unboxed} onBox={stableBox}>
              {onGlass && siteUrl && <Address url={siteUrl} typed={typed} place="glass" />}
            </StageScreen>
          </div>
          {siteUrl && (
            <div className="max-w-full" style={{ width: SCREEN_W }}>
              <Nameplate url={siteUrl} visible={moved} leaving={unboxed}>
                {belowScreen && !afterglow && <Address url={siteUrl} typed={1} place="plate" />}
              </Nameplate>
            </div>
          )}
        </div>
      </LayoutGroup>

      <Curtain state={state} />

      {/* Both effects are clipped to the OPENING — below the valance's fringe,
          between the two bunched legs — so nothing is ever thrown across the
          cloth. The fireworks begin the moment the page lights on the glass
          and do not stop: they open the celebration and keep going, quieter,
          while the picture is held, until the grow, when no more are
          launched and the ones in the air burn out. */}
      <div
        aria-hidden
        className={unboxed ? "pointer-events-none absolute inset-0 z-[13]" : OPENING + " z-[13]"}
      >
        <FireworksCanvas
          active={lit}
          intensity={celebrating || unboxed ? 1 : lightingUp ? 0.75 : 0.35}
        />
      </div>
      <div aria-hidden className={OPENING + " z-50"}>
        <ConfettiCanvas active={celebrating} originX={0.5} originY={0.35} />
      </div>

      {/* FRONT — in front of the closed cloth. Padded so the block centres on
          the opening below the valance's hem and sits a touch above that
          centre, where the eye expects a thing to hang. */}
      <div className="relative z-20 flex h-svh flex-col items-center justify-center pt-[14vh] text-center sm:pt-[20vh]">
        {state === "PRESHOW" && <PreShow config={config} />}
        {state === "COUNT_IN" && <CountIn count={status.count} />}
      </div>

      <OperatorBar state={state} armed={status.armed} onArm={arm} onReset={reset} />
    </motion.div>
  );
}
