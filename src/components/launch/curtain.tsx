"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PARTING_MS, type CeremonyState } from "@/lib/ceremony-timing";
import { crests, deepFolds, pleats } from "./cloth";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * How far the cloth gathers as it opens.
 *
 * A real curtain does not slide sideways as a rigid board. It hangs on a
 * track, the leading carrier is pulled towards the wall, and every pleat
 * behind it bunches into a stack. `scaleX` down to 0.62 about a leading-edge
 * origin is that compression: the panel narrows towards the edge that is doing
 * the travelling, exactly as the folds do.
 */
const GATHER_SCALE = 0.62;

/** The tilt, in degrees. It pivots at the top, because that is where the track is. */
const OPEN_ROTATE = 2.5;

/**
 * How far each half travels, as a percentage of its own width (= 50vw).
 *
 * Scaling about the LEADING edge leaves that edge wherever the translate puts
 * it, so the gather buys no free distance: the edge still has to cross the
 * whole half-width, and then some, because the tilt swings the bottom of it
 * back towards the screen.
 *
 * With W = 50vw, H = 100vh and the origin at the panel's leading edge, the
 * rightmost point of the open left half is its bottom leading corner:
 *
 *   x_max = W + GATHER_SCALE * sin(2.5deg) * H + translate  <= 0
 *   translate <= -(W + 0.027 * H)
 *
 * i.e. as a fraction of W:  |translate| >= 1 + 0.027 * (H / W).
 *
 * H/W is twice the viewport's height:width ratio — 1.125 on a 16:9 screen,
 * 1.5 on the 4:3 hall projector, ~4.3 on a phone held portrait. 124% clears
 * all of them and holds until H/W = 8.9, a viewport more than four times
 * taller than it is wide. (104% did not: it left a ~9px sliver of cloth down
 * the outside of a 1920x1080 screen, and a hair more on 1024x768.)
 *
 * The OUTER edges are safe by construction rather than by margin. Framer
 * drives x, scaleX and rotate off the same eased progress u, so the outer edge
 * sits at `W * u * ((1 - GATHER_SCALE) - OPEN_X / 100)` = `-0.86 * W * u`: the
 * gather pulls it inwards by at most 0.38W while the translate has already
 * carried it 1.24W outwards. Negative for every u > 0, so the outer screen
 * edges stay covered for the whole sweep and no strip of bare stage ever opens
 * up behind the cloth. At u = 1 the panel spans -1.10W..-0.24W, clear of the
 * screen by a quarter of its own width.
 */
const OPEN_X = 124;

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
  const phase = isLeft ? 0 : 3;

  // Spelled out per side rather than built with a computed key, so the
  // transform origin can share the object without widening its type.
  const anchor: CSSProperties = isLeft
    ? { left: 0, transformOrigin: "100% 0%" }
    : { right: 0, transformOrigin: "0% 0%" };

  return (
    <motion.div
      className="absolute inset-y-0 w-1/2"
      style={anchor}
      // Explicitly closed, never `initial={false}`. The rehearsal jump keys
      // remount this component straight into PARTING; with no initial state the
      // halves snap open with no motion, which is the one thing the jump keys
      // exist to let the operator watch. On the first PRESHOW mount `open` is
      // false, so initial and animate agree and nothing moves.
      initial={{ x: 0, scaleX: 1, rotate: 0 }}
      animate={
        open
          ? {
              x: isLeft ? `-${OPEN_X}%` : `${OPEN_X}%`,
              scaleX: GATHER_SCALE,
              rotate: isLeft ? -OPEN_ROTATE : OPEN_ROTATE,
            }
          : { x: 0, scaleX: 1, rotate: 0 }
      }
      // Reduced motion shortens the travel; it never removes it. The curtain is
      // the content of this beat, not decoration — skipping it leaves the hall
      // looking at an empty stage while the sweep plays.
      transition={{ duration: reduced ? 0.4 : PARTING_MS / 1000, ease: EASE }}
    >
      {/* Base cloth — deep crimson, darker than the brand primary so the
          primary still reads as the accent against it. */}
      <div className="absolute inset-0 bg-[hsl(346_60%_22%)]" />

      {/* The weave. Three passes on three periods that never line up — see
          `./cloth`. Background layers paint topmost-first, so the narrow crests
          sit over the broad folds, which sit over the base bands. Different
          phase per side, so the halves are not mirror images of each other. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            crests(phase + 1),
            deepFolds(phase),
            pleats(phase),
          ].join(", "),
        }}
      />

      {/* Sheen — a soft vertical highlight, offset per side so the halves are
          lit from the same imaginary source rather than mirrored. */}
      <div
        className="absolute inset-0"
        style={{
          background: isLeft
            ? "linear-gradient(90deg, rgba(0,0,0,0.5) 0%, transparent 45%, rgba(255,255,255,0.07) 78%, rgba(0,0,0,0.35) 100%)"
            : "linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(255,255,255,0.05) 22%, transparent 55%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Volume — an inner shadow down both outer edges, so the panel reads as
          a body of cloth curving away rather than a flat rectangle. */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow:
            "inset 18px 0 34px -18px rgba(0,0,0,0.85), inset -18px 0 34px -18px rgba(0,0,0,0.85)",
        }}
      />

      {/* The one kasavu thread, on the leading edge. One line reads as a
          selvedge; two or three read as tinsel. */}
      <div
        className="absolute inset-y-0 w-[3px] bg-[#D4A537] shadow-[0_0_18px_rgba(212,165,55,0.6)]"
        style={{ [isLeft ? "right" : "left"]: 0 }}
      />
    </motion.div>
  );
}

/**
 * The valance — the pelmet band across the top of the house.
 *
 * Without it the cloth floats: two panels with nothing holding them up. This is
 * the rigging. It is a darker crimson than the panels because it stands in
 * front of them and out of the wash, it carries its own gathered folds, and it
 * drops a shadow onto the cloth below so the panels read as hanging behind it.
 *
 * It does not move when the halves part, because in a real house it cannot —
 * the pelmet is fixed to the proscenium and only the traveler track runs. It is
 * rendered after the halves inside the same `z-[15]` layer, so it paints over
 * them by document order, which also covers the few pixels of top corner the
 * halves expose as their tilt swings in.
 */
function Valance() {
  return (
    <div
      className="absolute inset-x-0 top-0 h-[8vh] bg-[hsl(346_58%_16%)]"
      style={{
        backgroundImage: [
          "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%)",
          crests(5),
          pleats(5),
        ].join(", "),
        boxShadow: "0 16px 30px -8px rgba(0,0,0,0.75)",
      }}
    />
  );
}

/**
 * The curtain is the backdrop, not a lid.
 *
 * It sits at `z-[15]` — above the stage atmosphere (`z-10`) and below the
 * projected content (`z-20`), so the pre-show logo, the clock, the Unveil
 * button and the 3-2-1 all read in FRONT of the cloth. It then parts to reveal
 * the title card behind it. Rendering it over the content would hide the very
 * button the chief guest has to press.
 *
 * Kept mounted through PARTING so the halves animate out; removed entirely
 * afterwards so it can never intercept a click on the showcase beneath. The
 * valance goes with it.
 */
export function Curtain({ state }: { state: CeremonyState }) {
  const reduced = useReducedMotion();

  if (state === "CELEBRATING" || state === "SHOWCASE") return null;

  const open = state === "PARTING";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[15]">
      <Half side="left" open={open} reduced={Boolean(reduced)} />
      <Half side="right" open={open} reduced={Boolean(reduced)} />
      <Valance />
    </div>
  );
}
