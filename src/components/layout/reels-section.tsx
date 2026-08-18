"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Instagram } from "lucide-react";
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
      {/* Bounded to 80% of the viewport rather than the page's usual content
          width — the strip reads as an inset editorial column. */}
      <div className="mx-auto w-[80%]">
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

        {/* Masonry, kept genuinely compact: small fixed-size tiles (not
            stretched to fill a grid track), staggered by nudging alternate
            columns down half a card — so the wall stays short regardless of
            how many columns fit, instead of growing with the container. */}
        <motion.div
          className="flex gap-3 overflow-x-auto pb-2 sm:gap-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {columnsOf(reels, 5).map((column, colIndex) => (
            <div
              key={colIndex}
              className={cn("flex shrink-0 flex-col gap-3 sm:gap-4", colIndex % 2 === 1 && "mt-10")}
            >
              {column.map((reel, i) => (
                <motion.div
                  key={reel.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
                  }}
                >
                  <ReelTile reel={reel} tone={(colIndex + i) % 2 === 0 ? "primary" : "dark"} />
                </motion.div>
              ))}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/** Round-robins items into `count` columns, so a masonry grid can be built
 *  with plain flex columns instead of a JS layout library. */
function columnsOf<T>(items: T[], count: number): T[][] {
  const columns: T[][] = Array.from({ length: count }, () => []);
  items.forEach((item, i) => columns[i % count].push(item));
  return columns;
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
        "group relative flex aspect-[9/16] w-32 flex-col justify-between overflow-hidden rounded-xl p-3.5 transition-transform duration-500 hover:-translate-y-1 sm:w-36 sm:rounded-2xl sm:p-4",
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

      <Instagram className="relative h-3.5 w-3.5 text-white/75 sm:h-4 sm:w-4" strokeWidth={2} />

      <div className="relative">
        <p className="line-clamp-4 font-serif text-[11px] italic leading-snug text-white sm:text-[13px]">
          {reel.caption || "From the KSA feed"}
        </p>
        <span className="mt-1.5 inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-white/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:mt-2">
          Watch
          <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
      </div>
    </a>
  );
}
