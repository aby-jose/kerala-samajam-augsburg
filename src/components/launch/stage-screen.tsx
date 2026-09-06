"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The screen's width. The screen has the viewport's shape (below), so its
 * height is its width times the viewport's height over its width — which
 * makes a width of 57vw a height of 57vh on ANY display. The stage runs from
 * 28vh (under the valance's hem) to 96vh, 68vh in all; the nameplate under
 * the screen takes 9vh of it and the gap 2vh, and 57vh is what is left.
 * 124vmin caps it on very wide displays.
 *
 * The screen's SHAPE is the viewport's, not a fixed 16:9. The picture on it
 * is the page clipped to one viewport and scaled down, so a box of any other
 * shape leaves a band the page never reaches — on a browser window wider
 * than 16:9 the page ran out before the box did and the bottom stood blank.
 * Shaped to the viewport, the page fills it exactly, and the grow to full
 * screen is a pure scale with nothing to reveal and no bars to fill.
 */
export const SCREEN_W = "min(57vw, 124vmin)";

/** Where the screen is, for the page to be placed into it. */
export interface ScreenBox {
  /** Viewport offset of the box's top-left corner, in px. */
  x: number;
  y: number;
  /** Box width over viewport width: the scale that fits a viewport into it. */
  k: number;
  /** The box's corner radius in the page's own (unscaled) px. */
  radius: number;
}

/**
 * The screen on the stage — the frame, not the picture.
 *
 * The picture is the real home page, scaled into this box by `Ceremony`, one
 * layer below the overlay. This component draws what surrounds it: a hairline
 * of ivory for the bezel and a deep throw of shadow, so it stands in the
 * opening as an object rather than a rectangle drawn on the cloth; a dark
 * panel over it until the light-up; a breath of gloss on the glass.
 *
 * It reports its own box, measured, because the page below has to be moved
 * to exactly here, and CSS cannot hand one element's rectangle to another.
 */
export function StageScreen({
  mark,
  lit,
  leaving,
  onBox,
  children,
}: {
  /** The association's mark, faint on the dark glass while it stands by. */
  mark: string;
  /** True once the page should show on the glass. */
  lit: boolean;
  /** True while the page grows to full screen: the frame fades away. */
  leaving: boolean;
  onBox: (box: ScreenBox) => void;
  /** Whatever is written on the dark glass before the page: the address, typing. */
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The viewport's shape, as "w / h". 16:9 until measured; the observer
  // below reports once on observe, so the real shape lands before paint.
  const [aspect, setAspect] = useState("16 / 9");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setAspect(`${window.innerWidth} / ${window.innerHeight}`);
      const r = el.getBoundingClientRect();
      const k = r.width / window.innerWidth;
      onBox({
        x: r.left,
        y: r.top,
        k,
        // 0.7vmin, in the page's px: the page is scaled by k, so its radius
        // has to be divided by k to land at 0.7vmin on screen.
        radius: (Math.min(window.innerWidth, window.innerHeight) * 0.007) / k,
      });
    };
    // A ResizeObserver reports once on observe, so the first measurement
    // arrives before paint without a synchronous call here.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [onBox]);

  return (
    <motion.div
      ref={ref}
      className="relative w-full rounded-[0.7vmin]"
      style={{
        aspectRatio: aspect,
        boxShadow:
          "0 3vmin 8vmin -2vmin rgba(0,0,0,0.95), inset 0 0 0 0.16vmin rgba(246,238,224,0.2)",
      }}
      initial={false}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {/* Standing by: dark glass with a little light on it, and the mark
          faint behind it. Lifts to show the page beneath. */}
      <motion.div
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-[0.7vmin]"
        style={{ backgroundColor: "#090607" }}
        initial={false}
        animate={{ opacity: lit ? 0 : 1 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 28% 0%, rgba(255,255,255,0.07), transparent 62%)",
          }}
        />
        {/* The mark steps aside while something is written on the glass, so
            the address is read against plain dark and not through a seal. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mark}
          alt=""
          className="absolute left-1/2 top-1/2 h-[22%] w-auto -translate-x-1/2 -translate-y-1/2"
          style={{
            opacity: children ? 0 : 0.11,
            filter: "grayscale(1)",
            transition: "opacity 500ms ease-out",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      </motion.div>

      {/* A breath of gloss over whatever is on the glass. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[0.7vmin]"
        style={{
          background:
            "linear-gradient(170deg, rgba(255,255,255,0.05) 0%, transparent 34%, transparent 82%, rgba(0,0,0,0.18) 100%)",
        }}
      />
    </motion.div>
  );
}
