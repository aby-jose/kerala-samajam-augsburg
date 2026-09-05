"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Countdown } from "@/components/layout/countdown";
import { ceremonyAt } from "@/lib/ceremony-timing";
import { cn } from "@/lib/utils";
import { velvetCss } from "./cloth";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The house before the show: closed curtain, the association's name, and the
 * control the chief guest will press.
 *
 * Everything is sized in vmin. This is read from the back of a hall on an
 * unknown projector, where the useful unit is a fraction of the screen, and
 * a desktop-sized logo and button vanish into the cloth.
 *
 * The clock is atmosphere and nothing else — it never triggers the ceremony.
 * Ceremonies start late, and a page that fires itself on a schedule fires into
 * a room that is not ready.
 */
export function PreShow({
  armed,
  onTrigger,
}: {
  armed: boolean;
  onTrigger: () => void;
}) {
  const at = ceremonyAt();
  // `Countdown` renders nothing once its target passes, which on a ceremony
  // running ten minutes behind would leave the stage blank at the exact moment
  // the hall looks up. So "now" lives in state — set after mount and refreshed
  // every second so the page flips to "Beginning shortly" on its own — and the
  // Date itself is held rather than a boolean so `targetDate` narrows.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const upcoming = at && now !== null && at.getTime() > now ? at : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, ease: EASE }}
      className="flex flex-col items-center gap-[3.2vmin] text-center"
    >
      {/* No logo and no name here. Both are carved into the pavilion above —
          the mark hangs in the gable and the association's name is on the
          beam — and repeating them on the cloth would be the same words twice
          on one screen. */}
      {upcoming ? (
        <div className="flex flex-col items-center gap-[2vmin]">
          <p className="font-serif text-[3vmin] italic leading-none tracking-[-0.015em] text-white/75">
            The unveiling begins in
          </p>
          <Countdown targetDate={upcoming} />
        </div>
      ) : (
        <p className="font-serif text-[3.4vmin] italic leading-none tracking-[-0.015em] text-white/75">
          Beginning shortly
        </p>
      )}

      {/* The Unveil control is a piece of the curtain, not a web button: the
          same velvet, the kasavu braid repeated as a hairline along its foot.

          It is absent entirely while the stage is locked. "Stage locked" is
          operator language, and a dead grey plate in the middle of a closed
          curtain is the one thing on this screen that would look broken to a
          hall that has just sat down. The operator can see the lock state in
          the Alt+O panel, which is where it belongs. */}
      {armed && (
        <>
          <button
            type="button"
            onClick={onTrigger}
            aria-label="Unveil the website"
            className={cn(
              "relative mt-[2vmin] flex h-[11vmin] w-[40vmin] items-center justify-center overflow-hidden rounded-[0.4vmin]",
              "font-sans text-[4vmin] font-extrabold tracking-[0.04em] text-white",
              "shadow-[0_1.4vmin_3vmin_-1vmin_rgba(0,0,0,0.9)] transition-[transform,filter] duration-200 ease-out",
              "hover:-translate-y-[0.2vmin] hover:brightness-110 active:translate-y-[0.1vmin] active:brightness-95"
            )}
            style={{ backgroundImage: velvetCss(2, 7) }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/35"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[0.35vmin] bg-[#C9A227]"
            />
            <span className="relative drop-shadow-[0_0.2vmin_0.6vmin_rgba(0,0,0,0.8)]">
              Unveil
            </span>
          </button>

          <p className="text-[1.8vmin] text-white/45">Press the button, or the spacebar</p>
        </>
      )}
    </motion.div>
  );
}
