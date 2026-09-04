"use client";

import { AnimatePresence, motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * One enormous numeral per beat.
 *
 * Sized in `vmin` rather than a Tailwind step because this is read from the
 * back of a hall on an unknown projector, where the useful unit is a fraction
 * of the screen rather than a pixel count.
 */
export function CountIn({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.span
          key={count}
          initial={{ opacity: 0, scale: 1.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="block font-sans font-extrabold leading-none tracking-[-0.05em] text-white tabular-nums"
          style={{ fontSize: "38vmin" }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
