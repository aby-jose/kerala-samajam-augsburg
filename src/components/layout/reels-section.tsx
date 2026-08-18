"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Instagram } from "lucide-react";
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

function ReelCardTile({ reel }: { reel: ReelCardData }) {
  return (
    <a
      href={reel.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block h-[420px] w-[236px] overflow-hidden rounded-[1.75rem] border border-border/10 bg-muted"
    >
      {reel.cloudinaryVideoUrl ? (
        <video
          src={reel.cloudinaryVideoUrl}
          poster={reel.cloudinaryThumbnailUrl ?? undefined}
          muted
          loop
          playsInline
          onMouseEnter={(e) => e.currentTarget.play()}
          onMouseLeave={(e) => e.currentTarget.pause()}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <GradientFallback caption={reel.caption} />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/10 to-transparent p-4">
        {reel.caption && (
          <p className="line-clamp-2 text-xs font-medium text-white/90">{reel.caption}</p>
        )}
      </div>
    </a>
  );
}

/** Shown for a featured reel that hasn't finished caching yet, or whose cache
 *  attempt failed — an animated gradient built from the site's own primary
 *  and surface tokens, not a generic rainbow, so the strip never reads as
 *  broken mid-sync (spec D8). */
function GradientFallback({ caption }: { caption: string | null }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-[length:200%_200%] bg-linear-to-br from-primary via-primary/70 to-surface-deep"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Instagram className="h-8 w-8 text-white/90" strokeWidth={1.5} />
        {caption && <p className="line-clamp-3 text-xs font-medium text-white/90">{caption}</p>}
      </div>
    </div>
  );
}
