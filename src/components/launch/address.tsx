"use client";

import { motion } from "framer-motion";
import { ADDRESS_MOVE_MS } from "@/lib/ceremony-timing";
import { cn } from "@/lib/utils";

/** The move down to the caption: slow to leave, slow to land. */
const MOVE_EASE = [0.65, 0, 0.35, 1] as const;
const IVORY = "#F6EEE0";
const GOLD = "#C9A227";

/** The address as a person would type it: no scheme, `www.` in front. */
export function displayUrl(url: string): string {
  const host = url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return host.startsWith("www.") ? host : `www.${host}`;
}

/**
 * The address, in the one place it is at any moment.
 *
 * It is written on the dark glass first, letter by letter with a caret,
 * where the hall is already looking. Then it settles into the nameplate
 * beneath the screen, and the page takes the glass. The move is one element
 * travelling: both places render this component with the same `layoutId`,
 * and when the glass copy unmounts and the plate copy mounts, framer carries
 * it from the one box to the other, shrinking on the way.
 *
 * The typing is CENTRED AND STILL. Every letter is laid out from the first
 * frame and the untyped ones are simply invisible, so the line sits where
 * it will end up and the letters appear in their places — rather than a
 * growing line that re-centres itself and slides left with each keystroke.
 *
 * Set in the site's own sans, bold, the way the home page sets its
 * headline: this is the site's name, and it should look like the site
 * wrote it. The `www.` is dimmed, as an address bar dims it.
 */
export function Address({
  url,
  typed,
  place,
}: {
  url: string;
  /** How much of the address has been typed, 0–1. Only read on the glass. */
  typed: number;
  place: "glass" | "plate";
}) {
  const text = displayUrl(url);
  const onGlass = place === "glass";
  const count = onGlass
    ? Math.round(text.length * Math.max(0, Math.min(1, typed)))
    : text.length;
  const prefix = text.startsWith("www.") ? 4 : 0;
  const letters = Array.from(text);

  return (
    <motion.span
      layoutId="ceremony-address"
      layout
      transition={{ layout: { duration: ADDRESS_MOVE_MS / 1000, ease: MOVE_EASE } }}
      className={cn(
        "relative inline-flex items-baseline whitespace-nowrap font-sans font-bold leading-none tracking-[-0.01em]",
        onGlass ? "text-[5vmin]" : "text-[2.8vmin]"
      )}
      style={{ color: IVORY, textShadow: "0 0.3vmin 1.4vmin rgba(0,0,0,0.7)" }}
    >
      {letters.slice(0, count).map((ch, i) => (
        <span key={i} style={{ opacity: i < prefix ? 0.5 : 1 }}>
          {ch}
        </span>
      ))}
      {onGlass && (
        // The caret: a bar the height of the type, blinking on a one-second
        // cycle, the way a browser's does while it waits for the next key.
        // It sits after the last typed letter, inside the reserved line.
        <span
          aria-hidden
          className="mx-[0.25vmin] inline-block w-[0.24vmin] self-stretch"
          style={{
            backgroundColor: GOLD,
            animation: "ceremony-caret 1s steps(1, end) infinite",
          }}
        />
      )}
      {letters.slice(count).map((ch, i) => (
        <span key={count + i} aria-hidden style={{ opacity: 0 }}>
          {ch}
        </span>
      ))}
      <style>{`@keyframes ceremony-caret { 0%, 55% { opacity: 1 } 56%, 100% { opacity: 0 } }`}</style>
    </motion.span>
  );
}
