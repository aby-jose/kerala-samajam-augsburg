"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Accent } from "@/components/layout/section-heading";
import { cn } from "@/lib/utils";
import type { SiteConfig } from "@/lib/config-schema";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The moment itself: what the hall sees the instant the curtain clears.
 *
 * One serif italic word in crimson, exactly as the home page hero does it. The
 * draft used a gold gradient fill across the whole headline, which belongs to
 * no part of this brand.
 *
 * `compact` renders the same content smaller and tighter, for the SHOWCASE
 * beat where this card shares the screen with the QR/features panel — at
 * 1920x1080 the full-size card plus that panel can overflow vertically and
 * push the QR code off a projector screen.
 */
export function TitleCard({
  config,
  compact = false,
}: {
  config: SiteConfig;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.1, ease: EASE }}
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "gap-4" : "gap-8"
      )}
    >
      <Image
        src={config.branding.logoUrl || "/images/logo.png"}
        alt={config.siteName}
        width={128}
        height={128}
        className={cn("w-auto", compact ? "h-14" : "h-24")}
        priority
      />

      <h1
        className={cn(
          "max-w-4xl text-balance font-sans font-extrabold leading-[1.06] tracking-[-0.035em] text-white",
          compact ? "text-3xl md:text-4xl" : "text-5xl md:text-7xl"
        )}
      >
        {config.siteName} is <Accent>live</Accent>
      </h1>

      <p className="max-w-xl text-base leading-relaxed text-white/60">
        Our digital home is open. Everything the community does, in one place.
      </p>
    </motion.div>
  );
}
