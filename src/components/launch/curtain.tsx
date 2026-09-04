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

function Half({ side, open }: { side: "left" | "right"; open: boolean }) {
  const isLeft = side === "left";

  return (
    <motion.div
      className="absolute inset-y-0 w-1/2 origin-top"
      style={{ [isLeft ? "left" : "right"]: 0 }}
      initial={false}
      animate={
        open
          ? { x: isLeft ? "-104%" : "104%", rotate: isLeft ? -2.5 : 2.5 }
          : { x: 0, rotate: 0 }
      }
      transition={{ duration: PARTING_MS / 1000, ease: EASE }}
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
 * The curtain sits above the stage until the moment it does not.
 *
 * Kept mounted through PARTING so the halves animate out; removed entirely
 * afterwards so it can never intercept a click on the showcase beneath.
 */
export function Curtain({ state }: { state: CeremonyState }) {
  const reduced = useReducedMotion();

  if (state === "CELEBRATING" || state === "SHOWCASE") return null;

  const open = state === "PARTING";

  // Reduced motion shortens the travel rather than removing it. The curtain is
  // the content here, not decoration — cutting it leaves an empty stage.
  if (reduced && open) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-40">
      <Half side="left" open={open} />
      <Half side="right" open={open} />
    </div>
  );
}
