"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PARTING_MS, type CeremonyState } from "@/lib/ceremony-timing";
import { foldStops } from "./cloth";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * How much of each half survives as a leg once the curtain is drawn.
 *
 * A stage curtain does not leave. It is pulled to the walls and bunches there
 * for the rest of the evening, framing whatever is on the stage. Scaling each
 * half about its OUTER edge is exactly that draw: the leading edge travels
 * from centre to wall, and every fold behind it compresses into the stack.
 */
const LEG_SCALE = 0.15;

/**
 * Each half is wider than half the screen, so the two OVERLAP at the centre.
 *
 * Two panels butted edge to edge leave a hard vertical seam straight down the
 * middle of the projection — a join no real curtain has, because real panels
 * lap. 54% each gives an 8% lap: the right panel hangs in front of the left,
 * and the shadow it casts is what the eye reads as depth instead of a line.
 */
const HALF_W = 54;

const VALANCE_VH = 13;
const GOLD = "#C9A227";

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

  // Anchored at the outer edge, so the draw compresses the folds toward the wall.
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
          {/* Hanging: shadow under the valance, weight at the hem. */}
          <linearGradient id={`${id}-hang`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.66" />
            <stop offset="0.15" stopColor="#000" stopOpacity="0" />
            <stop offset="0.8" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.6" />
          </linearGradient>
          {/* The lap. The left panel lies UNDER the right, so it takes a wide,
              soft shadow across its leading edge; the right panel's leading
              edge is in the light and takes a thin highlight. Together they
              read as one panel in front of another instead of a seam. */}
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
          {/* The nap. */}
          <filter id={`${id}-nap`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed={isLeft ? 5 : 17} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>

        {/* Oversized so the displaced edges never expose the stage behind. */}
        <rect x="-60" y="-60" width="1120" height="1120" fill={`url(#${id}-folds)`} filter={`url(#${id}-drape)`} />
        <rect x="0" y="0" width="1000" height="1000" filter={`url(#${id}-nap)`} opacity="0.1" style={{ mixBlendMode: "overlay" }} />
        <rect x="0" y="0" width="1000" height="1000" fill={`url(#${id}-hang)`} />
        <rect x="0" y="0" width="1000" height="1000" fill={`url(#${id}-lap)`} />
      </svg>

      {/* Bunched cloth is in its own shadow. Fades in as the leg gathers. */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 0.4 : 0 }}
        transition={{ duration: reduced ? 0.5 : PARTING_MS / 1000, ease: EASE }}
      />
    </motion.div>
  );
}

/**
 * The scalloped lower edge of the valance across a 1000-unit-wide box.
 * `y` is the height of the points between swags; each swag dips below them.
 */
function swag(y: number, depth: number, count = 5): string {
  const w = 1000 / count;
  let d = `M0 ${y}`;
  for (let i = 0; i < count; i++) {
    const x0 = i * w;
    d += ` Q ${x0 + w / 2} ${y + depth * 2} ${x0 + w} ${y}`;
  }
  return d;
}

/**
 * The valance — the pelmet across the top of the proscenium.
 *
 * Fixed, because in a real house it is fixed: only the traveller runs. It
 * stays for the whole evening and, with the two legs, is what frames the
 * showcase as a stage rather than a web page.
 *
 * Gold is ONE clean braid following the scallop, and nothing else. A dashed
 * bullion fringe with tassels was tried and read as hazard tape from any
 * distance — the alternating gold and dark scanned as stripes long before it
 * scanned as thread. At projector scale a single line of trim is the only
 * gold that survives.
 */
function Valance() {
  const stops = foldStops(5, 30);
  const edge = swag(72, 15);

  return (
    <>
      <svg
        className="absolute inset-x-0 top-0 w-full"
        style={{ height: `${VALANCE_VH}vh` }}
        viewBox="0 0 1000 110"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="valance-folds" x1="0" x2="1" y1="0" y2="0">
            <Stops stops={stops} />
          </linearGradient>
          <linearGradient id="valance-shade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.45" />
            <stop offset="0.35" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.55" />
          </linearGradient>
          <filter id="valance-drape" x="-6%" y="-20%" width="112%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="2" seed="23" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="9" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <clipPath id="valance-clip">
            <path d={`${edge} L1000 0 L0 0 Z`} />
          </clipPath>
        </defs>

        <g clipPath="url(#valance-clip)">
          <rect x="-40" y="-20" width="1080" height="150" fill="url(#valance-folds)" filter="url(#valance-drape)" />
          <rect x="0" y="0" width="1000" height="110" fill="url(#valance-shade)" />
        </g>

        {/* One braid. Drawn twice: a dark line a hair below to seat it against
            the cloth, then the gold itself. */}
        <path d={swag(73.5, 15)} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="4" />
        <path d={edge} fill="none" stroke={GOLD} strokeWidth="2.6" strokeOpacity="0.9" />
      </svg>

      {/* The valance casts onto whatever is below it — cloth or stage. */}
      <div
        className="absolute inset-x-0"
        style={{
          top: `${VALANCE_VH}vh`,
          height: "7vh",
          background: "linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0))",
        }}
      />
    </>
  );
}

/**
 * The house curtain.
 *
 * Sits at `z-[15]`: above the stage atmosphere (`z-10`) and the STAGE layer
 * (`z-[12]`, where the browser, title card and showcase live), and below the
 * FRONT layer (`z-20`, the pre-show and the count-in). So before the reveal
 * the logo, clock and Unveil button read in front of the closed cloth, and
 * when the cloth draws it uncovers what was already standing behind it.
 *
 * Always mounted. The legs and the valance stay for the whole evening.
 */
export function Curtain({ state }: { state: CeremonyState }) {
  const reduced = Boolean(useReducedMotion());
  const open = state !== "PRESHOW" && state !== "COUNT_IN";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      <Half side="left" open={open} reduced={reduced} />
      <Half side="right" open={open} reduced={reduced} />
      <Valance />
    </div>
  );
}
