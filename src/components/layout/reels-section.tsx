"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Instagram } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Eyebrow, SectionLead, SectionTitle } from "@/components/layout/section-heading";
import { DEFAULT_HOME_CONTENT, type HomeContentT } from "@/lib/home-schema";
import { getFeaturedReels, type ReelCardData } from "@/lib/instagram-actions";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export function ReelsSection({
  content = DEFAULT_HOME_CONTENT.content.reels,
  surface = "bg-surface-1",
  bordered = false,
}: {
  content?: HomeContentT["content"]["reels"];
  surface?: string;
  bordered?: boolean;
} = {}) {
  const [reels, setReels] = useState<ReelCardData[]>([]);

  useEffect(() => {
    getFeaturedReels(content.maxCount)
      .then(setReels)
      .catch((error) => console.error("Failed to load featured reels:", error));
    // content.maxCount only changes when an admin edits the section, not per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.maxCount]);

  // Nothing featured yet (or Instagram isn't connected) — no empty band, per
  // spec D9. A featured-but-not-yet-cached reel still counts as present, so
  // this only fires when the featured list itself is empty.
  if (reels.length === 0) return null;

  return (
    <section
      className={cn(
        "relative overflow-hidden py-24 md:py-32",
        surface,
        bordered && "border-y border-border"
      )}
    >
      {/* Same Container the Committee section (and every other section)
          uses — max-w-screen-2xl, not a viewport-percentage width or the
          full screen — so this section's width matches the rest of the
          page, marquee included. */}
      <Container>
        {/* Same header shape as GalleryStrip, the sibling section this one
            most resembles: heading on the left, a count-free "view all" link
            on the right, both anchored to the row's baseline. */}
        <motion.div
          className="mb-12 flex flex-col justify-between gap-8 md:flex-row md:items-end"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="max-w-2xl">
            <Eyebrow>Instagram</Eyebrow>
            <SectionTitle className="mt-6">{content.heading}</SectionTitle>
            {content.subheading && (
              <SectionLead className="mt-5 max-w-lg">{content.subheading}</SectionLead>
            )}
          </div>

          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground"
          >
            <span className="border-b border-foreground/30 pb-0.5 transition-colors group-hover:border-primary group-hover:text-primary">
              Follow along
            </span>
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </a>
        </motion.div>
      </Container>

      {/* Same Container as the header — the marquee now clips at the page's
          normal content width instead of bleeding to the screen edge. */}
      <Container>
        <div className="overflow-hidden">
          <div className="flex w-max animate-marquee gap-4 motion-reduce:animate-none sm:gap-5 hover:[animation-play-state:paused]">
            {[...reels, ...reels, ...reels, ...reels].map((reel, i) => (
              <ReelTile key={`${reel.id}-${i}`} reel={reel} tone={i % 2 === 0 ? "primary" : "dark"} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * A solid field of the site's own primary or near-black — never a stand-in
 * photo — carrying the caption directly, the way a press clipping carries a
 * pull quote. Fixed at the real 9:16 reel ratio. Real cached video plays in
 * the same card once it exists, with the identical icon-top/caption-bottom
 * shell over a scrim, so the wall doesn't visually reshuffle itself the day
 * Instagram connects.
 */
function ReelTile({ reel, tone }: { reel: ReelCardData; tone: "primary" | "dark" }) {
  return (
    <a
      href={reel.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group relative flex aspect-[9/16] w-48 shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-5 transition-transform duration-500 hover:-translate-y-1 sm:w-60 sm:p-6",
        reel.cloudinaryVideoUrl || tone === "dark" ? "bg-surface-deep" : "bg-primary"
      )}
    >
      {reel.cloudinaryVideoUrl && (
        <video
          src={reel.cloudinaryVideoUrl}
          poster={reel.cloudinaryThumbnailUrl ?? undefined}
          muted
          loop
          playsInline
          preload="none"
          onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
          onMouseLeave={(e) => e.currentTarget.pause()}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {reel.cloudinaryVideoUrl && (
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
      )}

      <Instagram className="relative h-5 w-5 text-white/75 sm:h-6 sm:w-6" strokeWidth={2} />

      <div className="relative">
        <p className="line-clamp-5 font-serif text-base italic leading-snug text-white sm:text-lg">
          {reel.caption || "From the KSA feed"}
        </p>
        <span className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:mt-3 sm:text-[11px]">
          Watch
          <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
        </span>
      </div>
    </a>
  );
}
