"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Countdown } from "@/components/layout/countdown";
import { Eyebrow } from "@/components/layout/section-heading";
import { ceremonyAt } from "@/lib/ceremony-timing";
import type { SiteConfig } from "@/lib/config-schema";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * What the projector shows for the twenty minutes before anything happens.
 *
 * The clock is atmosphere and nothing else — it never triggers the ceremony.
 * Ceremonies start late, and a page that fires itself on a schedule fires into
 * a room that is not ready.
 */
export function PreShow({
  config,
  armed,
  onTrigger,
}: {
  config: SiteConfig;
  armed: boolean;
  onTrigger: () => void;
}) {
  const at = ceremonyAt();
  // `Countdown` renders nothing once its target passes, which on a ceremony
  // running ten minutes behind would leave the stage blank at the exact moment
  // the hall looks up. Decide up front whether there is a future moment to
  // count towards, and hold a line instead when there is not.
  //
  // `Date.now()` can't be read during render — it's impure, and a request
  // straddling the ceremony instant would compute a different value during
  // SSR than at first client paint, causing a hydration mismatch. So "now"
  // lives in state instead: unset until an effect populates it after mount,
  // then refreshed every second so the page keeps re-evaluating on its own —
  // it sits on a projector for twenty minutes and must flip over to
  // "Beginning shortly" by itself once the clock runs out. While `now` is
  // still null (server render and first paint) we fall back to that same
  // held line rather than guessing, which also removes the mismatch.
  //
  // This holds the Date itself rather than a boolean so the JSX below narrows:
  // a separate `const upcoming = at !== null && ...` does not narrow `at`, and
  // `targetDate={at}` would fail to compile against `Date | null`.
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
      className="flex flex-col items-center gap-8 text-center"
    >
      <Image
        src={config.branding.logoUrl || "/images/logo.png"}
        alt={config.siteName}
        width={96}
        height={96}
        className="h-20 w-auto"
        priority
      />

      <Eyebrow tone="dark">Grand Inauguration</Eyebrow>

      {upcoming ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm uppercase tracking-[0.22em] text-white/50">
            The unveiling begins in
          </p>
          <Countdown targetDate={upcoming} />
        </div>
      ) : (
        <p className="font-sans text-2xl font-extrabold tracking-[-0.035em] text-white/80">
          Beginning shortly
        </p>
      )}

      <button
        type="button"
        onClick={onTrigger}
        disabled={!armed}
        aria-label={armed ? "Unveil the website" : "Stage locked"}
        className={cn(
          "mt-4 rounded-2xl px-12 py-6 font-sans text-2xl font-extrabold tracking-[-0.02em] transition-all",
          armed
            ? "bg-primary text-white shadow-[0_0_60px_-10px_hsl(346.8_77.2%_49.8%)] hover:scale-[1.03] active:scale-[0.98]"
            : "cursor-not-allowed border border-white/10 bg-white/5 text-white/30"
        )}
      >
        {armed ? "Unveil" : "Stage locked"}
      </button>

      {armed && (
        <p className="text-xs text-white/40">
          Press the button, or the spacebar
        </p>
      )}
    </motion.div>
  );
}
