"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BROWSER_CURSOR_MS,
  BROWSER_SUBMIT_MS,
  BROWSER_TYPE_MS,
} from "@/lib/ceremony-timing";

const EASE = [0.16, 1, 0.3, 1] as const;

const CREAM = "#F5EFE6";
const INK = "#1A1618";

/** A plain arrow pointer. White fill, dark outline, so it reads on any ground. */
function Pointer() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
      <path
        d="M5 2.5 L5 19.2 L9.1 15.3 L11.7 21.3 L14.6 20.1 L12.0 14.2 L18 14.0 Z"
        fill="#fff"
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The beat between the curtain and the celebration: somebody goes to the site.
 *
 * The hall does not need to be told the address — it needs to WATCH it being
 * typed, because that is the action every person there will repeat on their
 * own phone thirty seconds later. So this is only the address bar: a pointer
 * crosses to it, clicks, the address types itself out a character at a time,
 * and the pointer moves to Go and presses it. No browser window frame, no
 * fake page behind it — an empty white rectangle in the middle of a ceremony
 * is a hole, and the bar alone says everything the frame would.
 *
 * The pointer's two stops are measured from the real DOM rather than guessed
 * in percentages, so it lands on the pill and the button at every viewport
 * this might be projected at.
 */
export function BrowserReveal({
  url,
  active,
}: {
  url: string;
  /** False while the curtain is still drawing: the bar is there, empty, waiting. */
  active: boolean;
}) {
  const reduced = Boolean(useReducedMotion());

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const goRef = useRef<HTMLDivElement | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const [stops, setStops] = useState<{
    pill: { x: number; y: number };
    go: { x: number; y: number };
  } | null>(null);

  // Measure once the bar has laid out, and again on resize.
  useEffect(() => {
    function measure() {
      const wrap = wrapRef.current;
      const pill = pillRef.current;
      const go = goRef.current;
      if (!wrap || !pill || !go) return;

      const w = wrap.getBoundingClientRect();
      const p = pill.getBoundingClientRect();
      const g = go.getBoundingClientRect();

      setStops({
        // A little left of the pill's centre, where a person would click to type.
        pill: { x: p.left - w.left + p.width * 0.28, y: p.top - w.top + p.height * 0.6 },
        go: { x: g.left - w.left + g.width * 0.5, y: g.top - w.top + g.height * 0.55 },
      });
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // One clock for the whole beat. Everything below is derived from it, so the
  // typing, the pointer and the click can never drift apart.
  useEffect(() => {
    // No reset here: every value derived from `elapsed` is already gated on
    // `active`, so a stale reading cannot show through, and setting state
    // straight from an effect body is a cascading render React warns about.
    if (!active) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setElapsed(now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const typeStart = reduced ? 0 : BROWSER_CURSOR_MS;
  const typeEnd = typeStart + (reduced ? BROWSER_TYPE_MS * 0.4 : BROWSER_TYPE_MS);
  const submitAt = typeEnd + (reduced ? 0 : BROWSER_SUBMIT_MS);

  const focused = active && elapsed >= typeStart;
  const typedCount = !active ? 0 : Math.max(
    0,
    Math.min(url.length, Math.round(((elapsed - typeStart) / (typeEnd - typeStart)) * url.length))
  );
  const typed = url.slice(0, typedCount);
  const doneTyping = active && elapsed >= typeEnd;
  const submitted = active && elapsed >= submitAt;

  // Two stops only: the pill while typing, then Go.
  const target = stops ? (doneTyping ? stops.go : stops.pill) : null;
  // A short press at each click, so the button visibly reacts.
  const pressing =
    (Math.abs(elapsed - typeStart) < 160 && !doneTyping) ||
    (submitted && elapsed - submitAt < 220);

  return (
    <div
      ref={wrapRef}
      className="relative w-full"
      style={{ maxWidth: "min(88vw, 104vmin)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="flex items-center gap-[1.6vmin] rounded-[1.4vmin] px-[2vmin] py-[1.6vmin] shadow-[0_2vmin_6vmin_-1.5vmin_rgba(0,0,0,0.8)]"
        style={{ backgroundColor: CREAM }}
      >
        {/* Navigation glyphs. Inert, and deliberately quiet — they are scenery
            that tells you this is a browser, not controls anyone will use. */}
        <div className="flex items-center gap-[1.2vmin] pl-[0.4vmin] pr-[0.6vmin]" aria-hidden>
          {["M15 5l-7 7 7 7", "M9 5l7 7-7 7"].map((d, i) => (
            <svg key={i} viewBox="0 0 24 24" className="h-[2.6vmin] w-[2.6vmin]" fill="none">
              <path d={d} stroke="#9A9095" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ))}
        </div>

        {/* The address pill. */}
        <div
          ref={pillRef}
          className="flex min-w-0 flex-1 items-center gap-[1.2vmin] rounded-full px-[2vmin] py-[1.4vmin]"
          style={{
            backgroundColor: "#fff",
            boxShadow: focused
              ? "0 0 0 0.35vmin rgba(225,29,72,0.35)"
              : "inset 0 0 0 0.15vmin rgba(0,0,0,0.08)",
            transition: "box-shadow 180ms ease-out",
          }}
        >
          <svg viewBox="0 0 24 24" className="h-[2.4vmin] w-[2.4vmin] shrink-0" fill="none" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="#6E6469" strokeWidth="1.8" />
            <path d="M8.5 11V8a3.5 3.5 0 017 0v3" stroke="#6E6469" strokeWidth="1.8" strokeLinecap="round" />
          </svg>

          <span
            className="truncate font-sans text-[3vmin] font-semibold tracking-[-0.01em]"
            style={{ color: INK }}
          >
            {typed}
            {focused && !submitted && (
              <motion.span
                aria-hidden
                className="ml-[0.2vmin] inline-block align-middle"
                style={{ width: "0.25vmin", height: "3vmin", backgroundColor: INK }}
                animate={{ opacity: [1, 1, 0, 0] }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear", times: [0, 0.5, 0.5, 1] }}
              />
            )}
          </span>
        </div>

        {/* Go. */}
        <div
          ref={goRef}
          className="shrink-0 rounded-full px-[2.6vmin] py-[1.4vmin] font-sans text-[2.6vmin] font-extrabold tracking-[-0.01em] text-white transition-transform duration-150"
          style={{
            backgroundColor: "hsl(346.8 77.2% 49.8%)",
            transform: submitted && elapsed - submitAt < 220 ? "scale(0.94)" : "scale(1)",
          }}
        >
          Go
        </div>
      </motion.div>

      {/* The load. Only after Go — it is the consequence of the click, and the
          bridge into the celebration. */}
      {submitted && (
        <motion.div
          className="absolute inset-x-[2vmin] -bottom-[1.2vmin] h-[0.5vmin] overflow-hidden rounded-full"
          style={{ backgroundColor: "rgba(245,239,230,0.16)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: "hsl(346.8 77.2% 49.8%)" }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </motion.div>
      )}

      {/* The pointer. Rendered last so it sits over the bar, and never during
          reduced motion, where there is no travel worth watching. */}
      {target && active && !reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-10 h-[4vmin] w-[4vmin] drop-shadow-[0_0.3vmin_0.6vmin_rgba(0,0,0,0.5)]"
          initial={{ x: target.x + 26 * 4, y: target.y + 22 * 4, opacity: 0 }}
          animate={{
            x: target.x,
            y: target.y,
            opacity: 1,
            scale: pressing ? 0.86 : 1,
          }}
          transition={{
            x: { duration: doneTyping ? BROWSER_SUBMIT_MS / 1000 : BROWSER_CURSOR_MS / 1000, ease: EASE },
            y: { duration: doneTyping ? BROWSER_SUBMIT_MS / 1000 : BROWSER_CURSOR_MS / 1000, ease: EASE },
            opacity: { duration: 0.3 },
            scale: { duration: 0.12 },
          }}
        >
          <Pointer />
        </motion.div>
      )}
    </div>
  );
}
