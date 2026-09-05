"use client";

import type { SiteConfig } from "@/lib/config-schema";

/**
 * The moment the address resolves: the site is up.
 *
 * No entrance animation of its own — the fireworks and the confetti carry the
 * beat, and a card that also slides in would be a third thing moving. The name
 * is the headline; the serif line under it is the whole sentence rather than
 * one accented word, which is the home page's voice without the tell.
 */
export function TitleCard({ config }: { config: SiteConfig }) {
  return (
    <div className="flex flex-col items-center gap-[2.4vmin] text-center">
      <h1 className="max-w-[82vw] text-balance font-sans text-[5.6vmin] font-extrabold leading-[1.02] tracking-[-0.035em] text-white drop-shadow-[0_0.4vmin_2vmin_rgba(0,0,0,0.6)]">
        {config.siteName}
      </h1>

      <p className="font-serif text-[2.8vmin] font-normal italic leading-none tracking-[-0.015em] text-white/80">
        We are live.
      </p>
    </div>
  );
}
