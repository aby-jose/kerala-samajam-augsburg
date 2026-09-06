"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Countdown } from "@/components/layout/countdown";
import { ceremonyAt } from "@/lib/ceremony-timing";
import type { SiteConfig } from "@/lib/config-schema";
import { cn } from "@/lib/utils";
import { BILL_NAME, BILL_STATUS, Braid } from "./bill";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The house before the show: closed curtain, the association's name, and the
 * state of the evening. Nothing else.
 *
 * There is no Unveil button. Space and Enter already start the ceremony from
 * anywhere on the page, so the button was a second door onto the same room —
 * and a web control sitting in the middle of a closed curtain is the one thing
 * on this screen that reads as a web page rather than a stage. The operator
 * can see the lock state in the Alt+O panel, which is where it belongs.
 *
 * Everything is sized in vmin. This is read from the back of a hall on an
 * unknown projector, where the useful unit is a fraction of the screen, and
 * a desktop-sized logo vanishes into the cloth.
 *
 * The clock is atmosphere and nothing else — it never triggers the ceremony.
 * Ceremonies start late, and a page that fires itself on a schedule fires into
 * a room that is not ready.
 */
export function PreShow({ config }: { config: SiteConfig }) {
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
      className="flex flex-col items-center text-center"
    >
      <Image
        src={config.branding.logoUrl || "/images/logo.png"}
        alt={config.siteName}
        width={256}
        height={256}
        // Set close to the name: the roundel and the name are one mark, not a
        // badge with a caption under it.
        className="h-[13vmin] w-auto drop-shadow-[0_2vmin_3vmin_rgba(0,0,0,0.65)]"
        priority
      />

      <h1 className={cn(BILL_NAME, "mt-[2vmin]")}>{config.siteName}</h1>

      <Braid />

      {upcoming ? (
        <div className="mt-[2.2vmin] flex flex-col items-center gap-[2vmin]">
          <p className={BILL_STATUS}>The unveiling begins in</p>
          <Countdown targetDate={upcoming} />
        </div>
      ) : (
        <p className={cn(BILL_STATUS, "mt-[2.2vmin]")}>Beginning shortly</p>
      )}

    </motion.div>
  );
}
