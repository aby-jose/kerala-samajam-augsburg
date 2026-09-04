"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { SiteConfig } from "@/lib/config-schema";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The moment itself: what the hall sees the instant the curtain clears.
 *
 * The name, and one serif line under it. Nothing says "is live" — a curtain
 * has just parted and confetti is still in the air, and captioning that in
 * text is the one thing on the stage that would read as a web page rather
 * than a ceremony. The serif italic runs across the whole line rather than
 * accenting a single word, which is the same voice as the home page hero
 * without the tell.
 *
 * CELEBRATING only. The showcase beat that follows is the URL and the QR
 * alone, so this card no longer has to share a screen with anything.
 */
export function TitleCard({ config }: { config: SiteConfig }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.1, ease: EASE }}
      className="flex flex-col items-center gap-8 text-center"
    >
      <Image
        src={config.branding.logoUrl || "/images/logo.png"}
        alt={config.siteName}
        width={192}
        height={192}
        className="h-28 w-auto md:h-36"
        priority
      />

      <h1 className="max-w-4xl text-balance font-sans text-5xl font-extrabold leading-[1.06] tracking-[-0.035em] text-white md:text-7xl">
        {config.siteName}
      </h1>

      <p className="max-w-2xl font-serif text-xl font-normal italic leading-relaxed tracking-[-0.015em] text-white/65 md:text-3xl">
        Our digital home is open.
      </p>
    </motion.div>
  );
}
