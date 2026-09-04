"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PARTING_MS, type CeremonyState } from "@/lib/ceremony-timing";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Irregular pleats.
 *
 * Evenly spaced bands read as exactly what they are — a repeating CSS
 * gradient. Real fabric bunches unevenly, so these stops are deliberately
 * uneven, and the two halves use different phases so the eye never catches
 * the symmetry.
 */
function pleats(phase: number): string {
  const stops: string[] = [];
  let at = 0;

  for (let i = 0; at < 100; i++) {
    const width = 3.2 + ((i * 7 + phase) % 5) * 0.9;
    const shade = i % 2 === 0 ? "rgba(0,0,0,0.34)" : "rgba(255,255,255,0.05)";
    stops.push(`${shade} ${at}%`, `${shade} ${Math.min(at + width, 100)}%`);
    at += width;
  }

  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

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

  return (
    <motion.div
      className="absolute inset-y-0 w-1/2 origin-top"
      style={{ [isLeft ? "left" : "right"]: 0 }}
      // Explicitly closed, never `initial={false}`. The rehearsal jump keys
      // remount this component straight into PARTING; with no initial state the
      // halves snap open with no motion, which is the one thing the jump keys
      // exist to let the operator watch. On the first PRESHOW mount `open` is
      // false, so initial and animate agree and nothing moves.
      initial={{ x: 0, rotate: 0 }}
      animate={
        open
          ? { x: isLeft ? "-104%" : "104%", rotate: isLeft ? -2.5 : 2.5 }
          : { x: 0, rotate: 0 }
      }
      // Reduced motion shortens the travel; it never removes it. The curtain is
      // the content of this beat, not decoration — skipping it leaves the hall
      // looking at an empty stage while the sweep plays.
      transition={{ duration: reduced ? 0.4 : PARTING_MS / 1000, ease: EASE }}
    >
      {/* Base cloth — deep crimson, darker than the brand primary so the
          primary still reads as the accent against it. */}
      <div className="absolute inset-0 bg-[hsl(346_60%_22%)]" />

      {/* Pleats. Different phase per side; see `pleats`. */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: pleats(isLeft ? 0 : 3) }}
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
 * The curtain is the backdrop, not a lid.
 *
 * It sits at `z-[15]` — above the stage atmosphere (`z-10`) and below the
 * projected content (`z-20`), so the pre-show logo, the clock, the Unveil
 * button and the 3-2-1 all read in FRONT of the cloth. It then parts to reveal
 * the title card behind it. Rendering it over the content would hide the very
 * button the chief guest has to press.
 *
 * Kept mounted through PARTING so the halves animate out; removed entirely
 * afterwards so it can never intercept a click on the showcase beneath.
 */
export function Curtain({ state }: { state: CeremonyState }) {
  const reduced = useReducedMotion();

  if (state === "CELEBRATING" || state === "SHOWCASE") return null;

  const open = state === "PARTING";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[15]">
      <Half side="left" open={open} reduced={Boolean(reduced)} />
      <Half side="right" open={open} reduced={Boolean(reduced)} />
    </div>
  );
}
