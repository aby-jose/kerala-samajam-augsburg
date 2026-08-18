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
      <Container>
        <motion.div
          className="mb-12 max-w-2xl"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <Eyebrow>Instagram</Eyebrow>
          <SectionTitle className="mt-6">{content.heading}</SectionTitle>
          {content.subheading && (
            <SectionLead className="mt-5 max-w-lg">{content.subheading}</SectionLead>
          )}
        </motion.div>
      </Container>

      <motion.div
        className="flex gap-4 overflow-x-auto px-6 pb-4 snap-x snap-mandatory md:px-[max(1.5rem,calc((100vw-72rem)/2))]"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
      >
        {reels.map((reel) => (
          <motion.div
            key={reel.id}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
            }}
            className="shrink-0 snap-start"
          >
            <ReelCardTile reel={reel} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/** The reel's own claim on the strip: a media frame with a fixed caption
 *  plate underneath it, like a print underneath the photograph rather than
 *  text burned into the image — so the same layout reads equally well for
 *  a real video or a still-caching placeholder, and never turns into a
 *  generic "gradient with white text stamped in the middle" card. */
function ReelCardTile({ reel }: { reel: ReelCardData }) {
  return (
    <a
      href={reel.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-[420px] w-[236px] flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface-1 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_32px_-24px_rgba(0,0,0,0.25)] transition-shadow duration-300 hover:shadow-[0_2px_4px_rgba(0,0,0,0.06),0_24px_40px_-20px_rgba(0,0,0,0.3)]"
    >
      <div className="relative flex-1 overflow-hidden bg-muted">
        {reel.cloudinaryVideoUrl ? (
          <video
            src={reel.cloudinaryVideoUrl}
            poster={reel.cloudinaryThumbnailUrl ?? undefined}
            muted
            loop
            playsInline
            preload="none"
            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => e.currentTarget.pause()}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <GradientFallback />
        )}

        {/* Same badge idiom the gallery already uses for its video tiles —
            one visual language for "this is a reel," on top of either state. */}
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-lg border border-white/15 bg-black/40 p-1.5 text-white backdrop-blur-md">
          <Instagram className="h-3 w-3" strokeWidth={2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Reel</span>
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3.5">
        {reel.caption ? (
          <p className="line-clamp-2 font-serif text-[13px] italic leading-snug text-foreground">
            {reel.caption}
          </p>
        ) : (
          <p className="text-[13px] italic leading-snug text-muted-foreground">
            From the KSA feed
          </p>
        )}
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-primary">
          View on Instagram
          <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
        </span>
      </div>
    </a>
  );
}

/** Shown for a featured reel that hasn't finished caching yet, or whose cache
 *  attempt failed — an animated gradient built from the site's own primary
 *  and surface tokens, not a generic rainbow, so the strip never reads as
 *  broken mid-sync (spec D8). The caption lives in the plate below, not
 *  stamped over the art, so this is free to just be the moving field of
 *  color plus one quiet editorial mark. */
function GradientFallback() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-[length:200%_200%] bg-linear-to-br from-primary via-primary/70 to-surface-deep"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      {/* A faint dot field for texture, so the gradient reads as a made
          surface rather than a flat CSS fill. */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "14px 14px",
          color: "white",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-8 right-2 select-none font-serif text-[9rem] italic leading-none text-white/10"
      >
        "
      </span>
    </div>
  );
}
