"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PARTING_MS, type CeremonyState } from "@/lib/ceremony-timing";
import { foldStops } from "./cloth";
import { GOLD, openingInset } from "./stage-geometry";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * How much of each half survives as a leg once the curtain is drawn.
 *
 * A stage curtain does not leave. It is pulled to the walls and bunches there
 * for the rest of the evening. Scaling each half about its OUTER edge is
 * exactly that draw: the leading edge travels from centre to pillar, and every
 * fold behind it compresses into the stack.
 */
const LEG_SCALE = 0.13;

/**
 * Each half is wider than half the opening, so the two OVERLAP at the centre.
 *
 * Two panels butted edge to edge leave a hard vertical seam down the middle of
 * the projection — a join no real curtain has, because real panels lap. 54%
 * each gives an 8% lap: the right panel hangs in front of the left, and the
 * shadow it casts is what the eye reads as depth instead of a line.
 */
const HALF_W = 54;

/** Height of the kasavu hem, as a percentage of the cloth. */
const HEM_H = 9;

function Stops({ stops }: { stops: ReturnType<typeof foldStops> }) {
  return (
    <>
      {stops.map((s, i) => (
        <stop key={i} offset={`${s.at}%`} stopColor={s.color} />
      ))}
    </>
  );
}

/**
 * One half of the traveller.
 *
 * The cloth is an SVG so it can carry two things CSS cannot: a low-frequency
 * displacement that lets the folds wander off the vertical the way hanging
 * fabric does, and a fine noise pass for the nap of the velvet. Both are
 * rasterised once; the container is the only thing that ever moves.
 */
function Half({
  side,
  open,
  reduced,
}: {
  side: "left" | "right";
  open: boolean;
  reduced: boolean;
}) {
  const isLeft = side === "left";
  const id = `curtain-${side}`;
  const stops = foldStops(isLeft ? 0 : 3);
  const hemY = 1000 - HEM_H * 10;

  // Anchored at the outer edge, so the draw compresses the folds toward the
  // pillar rather than sliding the panel off the stage.
  const anchor: CSSProperties = isLeft
    ? { left: 0, transformOrigin: "0% 50%" }
    : { right: 0, transformOrigin: "100% 50%" };

  return (
    <motion.div
      className="absolute inset-y-0 will-change-transform"
      style={{ width: `${HALF_W}%`, ...anchor }}
      // Explicitly closed, never `initial={false}`: the rehearsal jump keys
      // remount this straight into PARTING, and with no initial state it would
      // snap open with no motion — the one thing the jump keys exist to show.
      initial={{ scaleX: 1 }}
      animate={{ scaleX: open ? LEG_SCALE : 1 }}
      // Reduced motion shortens the draw; it never removes it. The curtain is
      // the content of this beat, not decoration.
      transition={{ duration: reduced ? 0.5 : PARTING_MS / 1000, ease: EASE }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${id}-folds`} x1="0" x2="1" y1="0" y2="0">
            <Stops stops={stops} />
          </linearGradient>
          {/* Hanging: shadow under the beam, weight gathering at the hem. */}
          <linearGradient id={`${id}-hang`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.72" />
            <stop offset="0.14" stopColor="#000" stopOpacity="0" />
            <stop offset="0.82" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.5" />
          </linearGradient>
          {/* The lap. The left panel lies UNDER the right, so it takes a wide
              soft shadow across its leading edge; the right panel's leading
              edge is in the light and takes a thin highlight. */}
          <linearGradient id={`${id}-lap`} x1="0" x2="1" y1="0" y2="0">
            {isLeft ? (
              <>
                <stop offset="0.72" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity="0.42" />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="#fff" stopOpacity="0.05" />
                <stop offset="0.05" stopColor="#fff" stopOpacity="0" />
              </>
            )}
          </linearGradient>
          {/* Kasavu: the gold zari border. Woven metal, so it is banded rather
              than a flat fill — the same folds that shade the velvet catch it. */}
          <linearGradient id={`${id}-kasavu`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={GOLD.dark} />
            <stop offset="0.12" stopColor={GOLD.pale} />
            <stop offset="0.3" stopColor={GOLD.mid} />
            <stop offset="0.52" stopColor={GOLD.bright} />
            <stop offset="0.78" stopColor={GOLD.mid} />
            <stop offset="1" stopColor={GOLD.dark} />
          </linearGradient>
          {/* Folds wander: a very low-frequency warp pushes the vertical folds
              a little off true, more so lower down where the cloth is freer. */}
          <filter id={`${id}-drape`} x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.0045 0.0018"
              numOctaves="2"
              seed={isLeft ? 3 : 11}
              result="warp"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="warp"
              scale="26"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <filter id={`${id}-nap`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed={isLeft ? 5 : 17} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>

        {/* Oversized so the displaced edges never expose the stage behind. */}
        <rect x="-60" y="-60" width="1120" height="1120" fill={`url(#${id}-folds)`} filter={`url(#${id}-drape)`} />
        <rect width="1000" height="1000" filter={`url(#${id}-nap)`} opacity="0.1" style={{ mixBlendMode: "overlay" }} />

        <rect width="1000" height="1000" fill={`url(#${id}-hang)`} />

        {/* The kasavu hem, drawn AFTER the hanging shadow rather than under
            it. Underneath, the shadow that gives the cloth its weight was
            also draining the gold, and woven zari came out as a grey band. */}
        <g>
          <rect y={hemY - 5} width="1000" height="5" fill="#000" opacity="0.5" />
          <rect y={hemY} width="1000" height={HEM_H * 10} fill={`url(#${id}-kasavu)`} />
          {/* Only the folds shade it, and only lightly: metal thread catches
              the same light the velvet does, but it does not go matte. */}
          <rect
            y={hemY}
            width="1000"
            height={HEM_H * 10}
            fill={`url(#${id}-folds)`}
            opacity="0.2"
            style={{ mixBlendMode: "multiply" }}
          />
          {[0.14, 0.27, 0.68, 0.86].map((f) => (
            <rect key={f} y={hemY + HEM_H * 10 * f} width="1000" height="3" fill={GOLD.dark} opacity="0.6" />
          ))}
          <rect y={hemY + 6} width="1000" height="2.5" fill={GOLD.pale} opacity="0.75" />
        </g>

        <rect width="1000" height="1000" fill={`url(#${id}-lap)`} />
      </svg>

      {/* Bunched cloth is in its own shadow. Fades in as the leg gathers. */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 0.42 : 0 }}
        transition={{ duration: reduced ? 0.5 : PARTING_MS / 1000, ease: EASE }}
      />
    </motion.div>
  );
}

/**
 * The house curtain, filling the pavilion's opening.
 *
 * Confined to the opening rather than the whole screen, so the pillars and the
 * carved beam frame it and the garlands hang in front of it. Always mounted:
 * the legs stay bunched against the pillars for the rest of the evening, the
 * way a real traveller does.
 */
export function Curtain({ state }: { state: CeremonyState }) {
  const reduced = Boolean(useReducedMotion());
  const open = state !== "PRESHOW" && state !== "COUNT_IN";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-[15] overflow-hidden"
      style={openingInset}
    >
      <Half side="left" open={open} reduced={reduced} />
      <Half side="right" open={open} reduced={reduced} />
    </div>
  );
}
