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

        {/* Same mosaic GalleryStrip uses — one hero tile carrying four
            smaller ones — so the two "recent content" sections on this page
            read as one family instead of two different components. */}
        <motion.div
          className={cn(
            "grid grid-cols-2 gap-3 md:gap-4",
            reels.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3"
          )}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
        >
          {reels.slice(0, 5).map((reel, i) => (
            <motion.div
              key={reel.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
              }}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-2xl",
                i === 0 && reels.length >= 5 && "col-span-2 row-span-2"
              )}
            >
              <ReelTile
                reel={reel}
                isHero={i === 0 && reels.length >= 5}
                tone={i % 2 === 0 ? "primary" : "dark"}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/**
 * A solid field of the site's own primary or near-black — never a stand-in
 * photo — carrying the caption directly, the way a press clipping carries a
 * pull quote. Real cached video plays in the same tile once it exists,
 * with the identical icon-top/caption-bottom shell over a scrim, so the
 * mosaic doesn't visually reshuffle itself the day Instagram connects.
 */
function ReelTile({
  reel,
  isHero,
  tone,
}: {
  reel: ReelCardData;
  isHero: boolean;
  tone: "primary" | "dark";
}) {
  return (
    <a
      href={reel.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "absolute inset-0 flex flex-col justify-between p-5 transition-transform duration-500 md:group-hover:-translate-y-1",
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

      <Instagram className="relative h-5 w-5 text-white/75" strokeWidth={2} />

      <div className="relative">
        <p
          className={cn(
            "font-serif italic leading-snug text-white line-clamp-4",
            isHero ? "text-2xl" : "text-base"
          )}
        >
          {reel.caption || "From the KSA feed"}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          Watch on Instagram
          <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
        </span>
      </div>
    </a>
  );
}
