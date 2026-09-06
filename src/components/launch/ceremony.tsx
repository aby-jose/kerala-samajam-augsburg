"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CEREMONY_EVENT } from "@/lib/ceremony-event";
import { GROW_MS, type CeremonyState } from "@/lib/ceremony-timing";
import type { SiteConfig } from "@/lib/config-schema";
import type { ScreenBox } from "./stage-screen";

// Loaded on the chord, never before: an ordinary visit downloads none of it.
const CeremonyOverlay = dynamic(
  () => import("./ceremony-overlay").then((m) => m.CeremonyOverlay),
  { ssr: false }
);

/** The grow: slow to leave, slow to land, like a camera dolly. */
const GROW_EASE = [0.6, 0, 0.2, 1] as const;

/**
 * How long the house takes to fade in over the page before the page is
 * moved. The overlay's own fade is 600ms; the page is scaled a beat after
 * it is fully covered, so nobody sees the site shrink.
 */
const RAISE_MS = 700;

const HOUSE = "hsl(350 10% 7%)";

/**
 * The launch ceremony, as a layer over the home page.
 *
 * This wraps the page tree in the public layout and, most of the time, is one
 * `div` doing nothing. With the switch on, it listens for Alt+Shift+L. On the
 * chord the overlay is loaded and fades in over the page; a beat later the
 * page — the real one, navbar, hero video and all — is scaled by one CSS
 * transform into the screen box the overlay draws on its stage, clipped to a
 * viewport's worth so the screen shows exactly the projector's first screen
 * of the site. The curtain draws on that. At the end the same transform runs
 * back to identity over the grow, the overlay is unmounted, and what is left
 * is the plain page, untouched and scrollable.
 *
 * The page is never remounted: the children stay in the same element and
 * only its class and transform change, so the hero video keeps playing
 * through the reveal and nothing on the page loses its state.
 *
 * While the curtain is closed the page's videos are paused. Nobody can see
 * them and decoding them under an SVG-filtered curtain is what made the
 * old page stutter. They resume as the curtain starts to move.
 */
export function Ceremony({
  enabled,
  config,
  siteUrl,
  children,
}: {
  enabled: boolean;
  config: SiteConfig;
  /** The public address, resolved on the server; undefined on localhost and previews. */
  siteUrl?: string;
  children: React.ReactNode;
}) {
  const reduced = Boolean(useReducedMotion());
  const [summoned, setSummoned] = useState(false);
  const [raised, setRaised] = useState(false);
  const [state, setState] = useState<CeremonyState>("PRESHOW");
  const [box, setBox] = useState<ScreenBox | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<CeremonyState>("PRESHOW");

  const dismiss = useCallback(() => {
    setSummoned(false);
    setRaised(false);
    setBox(null);
    setState("PRESHOW");
    stateRef.current = "PRESHOW";
  }, []);

  const onState = useCallback(
    (s: CeremonyState) => {
      stateRef.current = s;
      setState(s);
      // OFF is the overlay being gone. The grow has landed by now — its
      // timer and the transform share one duration — so removing the
      // transform here changes nothing the eye can see.
      if (s === "OFF") dismiss();
    },
    [dismiss]
  );

  // The chord. Only ever registered when the switch is on.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.altKey && e.shiftKey && e.code === "KeyL")) return;
      e.preventDefault();
      if (!summoned) setSummoned(true);
      else if (stateRef.current === "PRESHOW") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, summoned, dismiss]);

  // The house comes up first; the page is moved once it is covered.
  useEffect(() => {
    if (!summoned) return;
    const id = setTimeout(() => setRaised(true), RAISE_MS);
    return () => clearTimeout(id);
  }, [summoned]);

  // Scroll lock, pinned at the top, and the word to anything that would
  // otherwise sit over the stage. Both undone when the overlay comes down.
  useEffect(() => {
    if (!summoned) return;
    const html = document.documentElement;
    const previous = html.style.overflow;
    window.scrollTo(0, 0);
    html.style.overflow = "hidden";
    window.dispatchEvent(new CustomEvent(CEREMONY_EVENT, { detail: { active: true } }));
    return () => {
      html.style.overflow = previous;
      window.dispatchEvent(new CustomEvent(CEREMONY_EVENT, { detail: { active: false } }));
    };
  }, [summoned]);

  // Videos rest while the curtain is closed. Only the ones that were playing
  // are resumed, so a video the visitor had paused stays paused.
  const closed = summoned && (state === "PRESHOW" || state === "COUNT_IN");
  useEffect(() => {
    if (!closed) return;
    const playing = Array.from(pageRef.current?.querySelectorAll("video") ?? []).filter(
      (v) => !v.paused
    );
    playing.forEach((v) => v.pause());
    return () => {
      playing.forEach((v) => {
        void v.play().catch(() => {});
      });
    };
  }, [closed]);

  // The afterglow is the site already full screen, with only the fireworks
  // left over it: the page is let go — back into the flow, scrollable —
  // and the house floor beneath it comes away, while the overlay lingers.
  const afterglow = state === "AFTERGLOW";
  const staged = summoned && raised && box !== null && !afterglow;
  const growing = state === "GROW";
  const target =
    staged && !growing
      ? { x: box.x, y: box.y, scale: box.k }
      : { x: 0, y: 0, scale: 1 };
  const transition = growing
    ? { duration: reduced ? 0.3 : GROW_MS / 1000, ease: GROW_EASE }
    : { duration: 0 };

  return (
    <>
      {/* The house floor, under the page: the stage's near-black, the warm
          wash, the vignette and the grain. Static, never animated — this has
          to hold 60fps on whatever machine is driving the projector. Under
          the page rather than over it so the vignette darkens the floor and
          never the picture on the screen. */}
      {summoned && !afterglow && (
        <div aria-hidden className="fixed inset-0 z-[200]" style={{ backgroundColor: HOUSE }}>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 62% 50% at 50% 44%, hsl(352 55% 32% / 0.2) 0%, hsl(352 50% 22% / 0.08) 45%, transparent 74%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 65% at 50% 50%, transparent 0%, rgba(0,0,0,0.62) 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
        </div>
      )}

      {/* The page. Ordinarily a plain div; on stage, a fixed viewport-sized
          box clipped to one screen's worth and scaled into the screen. The
          navbar and the top loader are `fixed`, and inside a transformed
          ancestor `fixed` means fixed to that ancestor — which is exactly
          what puts them on the little screen, and exactly what lets them go
          when the transform is removed. */}
      <motion.div
        ref={pageRef}
        className={staged ? "fixed inset-0 z-[205] h-screen w-screen overflow-hidden" : undefined}
        style={{
          transformOrigin: "0 0",
          borderRadius: staged && !growing && box ? box.radius : 0,
          willChange: growing ? "transform" : undefined,
        }}
        initial={false}
        animate={target}
        transition={transition}
      >
        {children}
      </motion.div>

      {summoned && (
        <CeremonyOverlay
          config={config}
          siteUrl={siteUrl}
          onState={onState}
          onBox={setBox}
          onDismiss={dismiss}
        />
      )}
    </>
  );
}
