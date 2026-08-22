"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Instagram, Play } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Eyebrow, SectionLead, SectionTitle } from "@/components/layout/section-heading";
import { DEFAULT_HOME_CONTENT, type HomeContentT } from "@/lib/home-schema";
import { getFeaturedReels, type ReelCardData } from "@/lib/instagram-actions";
import { cloudinaryOptimize } from "@/lib/cloudinary-url";
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
          normal content width instead of bleeding to the screen edge. The
          fade softens that clip: cards dissolve near each edge instead of
          being sliced mid-card. */}
      <Container>
        <div className="overflow-hidden marquee-fade-x">
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
 * pull quote, for the rare reel with no cached thumbnail at all. Every
 * featured reel that has one shows its actual frame instead, the same still
 * image the admin list already shows for it — as a static photo at rest, the
 * way the admin table displays it, with the video (when one exists) fading
 * in and only playing on hover rather than every tile in the marquee racing
 * to buffer video at once.
 */
function ReelTile({ reel, tone }: { reel: ReelCardData; tone: "primary" | "dark" }) {
  const hasVideo = Boolean(reel.cloudinaryVideoUrl);
  // Cloudinary is the durable copy; Instagram's own thumbnail_url is a bridge
  // for a reel that was featured before a Cloudinary thumbnail existed to
  // cache (an older cache attempt, or one that failed before this fallback
  // existed) — it's temporary and can eventually 404, hence imgFailed below.
  const thumbnailUrl = reel.cloudinaryThumbnailUrl ?? reel.igThumbnailUrl;
  const [imgFailed, setImgFailed] = useState(false);
  const hasThumbnail = Boolean(thumbnailUrl) && !imgFailed;
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <a
      href={reel.permalink}
      target="_blank"
      rel="noopener noreferrer"
      // The hover handlers live here, on the whole card, rather than on the
      // <video> itself: the icon chip, play button and caption below are all
      // later in the DOM and stacked on top of it, covering the tile's full
      // height between them, so a listener on the video never actually saw
      // the pointer enter or leave.
      onMouseEnter={() => videoRef.current?.play().catch(() => {})}
      onMouseLeave={() => videoRef.current?.pause()}
      className={cn(
        "group relative flex aspect-[9/16] w-48 shrink-0 flex-col overflow-hidden rounded-2xl p-4 transition-transform duration-500 hover:-translate-y-1 sm:w-60 sm:p-5",
        hasThumbnail || tone === "dark" ? "bg-surface-deep" : "bg-primary"
      )}
    >
      {hasThumbnail && (
        <img
          src={cloudinaryOptimize(thumbnailUrl!, { width: 480 })}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}
      {hasVideo && (
        <video
          ref={videoRef}
          src={reel.cloudinaryVideoUrl!}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      )}
      {/* A quiet top-left glow gives the flat placeholder (nothing cached
          yet at all) some depth instead of reading as an empty block. */}
      {!hasThumbnail && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.14),transparent_60%)]" />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/15 to-black/5" />

      {/* Icon rides in its own chip instead of floating bare in empty
          space — reads as a designed mark, not a stray glyph. */}
      <span className="relative inline-flex w-fit items-center justify-center rounded-full bg-white/10 p-2 backdrop-blur-md ring-1 ring-white/15">
        <Instagram className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" strokeWidth={2} />
      </span>

      {/* Persistent play affordance fills the middle void and signals
          "video" even before hover — was invisible until group-hover. */}
      <span className="relative flex flex-1 items-center justify-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/25 backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:bg-white/20 sm:h-12 sm:w-12">
          <Play className="h-4 w-4 translate-x-[1px] fill-white text-white sm:h-[18px] sm:w-[18px]" />
        </span>
      </span>

      <div className="relative">
        {/* Caption in the site's own quiet serif body voice — the earlier
            italic treatment borrowed the single-accent-word italic used
            for headlines and stretched it over a five-line paragraph,
            which is what read as "off." Non-italic, three lines, tighter. */}
        <p className="line-clamp-3 font-serif text-[15px] leading-snug text-white/95 sm:text-base">
          {reel.caption || "From the KSA feed"}
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55 transition-colors duration-300 group-hover:text-white sm:text-[11px]">
          Watch on Instagram
          <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
        </span>
      </div>
    </a>
  );
}
