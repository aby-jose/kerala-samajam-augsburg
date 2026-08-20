import React from "react";
import { cn } from "@/lib/utils";

interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
}

/**
 * "Sponsored by" credit line for dark surfaces — the event hero and the
 * spotlight card. Each sponsor is a full glass pill (border, backdrop blur,
 * name spelled out), the same idiom as the date/category chips already on
 * those cards, rather than a bare logo trying to carry the brand alone at
 * a few pixels tall.
 */
export function SponsorChips({
  sponsors,
  className,
}: {
  sponsors?: Sponsor[];
  className?: string;
}) {
  if (!sponsors || sponsors.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        Sponsored by
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {sponsors.map((sponsor) => (
          <span
            key={sponsor.id}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] py-1 pl-1 pr-3 backdrop-blur-md"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
              <img
                src={sponsor.logoUrl}
                alt=""
                aria-hidden
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
                className="h-full w-full object-contain p-0.5"
              />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
              {sponsor.name}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
