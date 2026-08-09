"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Images } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import {
  Accent,
  Eyebrow,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import { getGalleryHighlights } from "@/lib/gallery-actions";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

interface Shot {
  id: string;
  url: string;
  caption?: string | null;
  albumId?: string;
  albumTitle?: string;
}

// Shown until the real albums load — and if the gallery is still empty.
const fallbackShots: Shot[] = [
  { id: "f1", url: "/images/gallery/onam_pookalam.png", albumTitle: "Onam" },
  { id: "f2", url: "/images/gallery/kerala_sadya.png", albumTitle: "Onasadhya" },
  { id: "f3", url: "/images/gallery/thiruvathira_dance.png", albumTitle: "Thiruvathira" },
  { id: "f4", url: "/images/gallery/kathakali_performer.png", albumTitle: "Kathakali" },
  { id: "f5", url: "/images/gallery/community_picnic.png", albumTitle: "Summer picnic" },
];

export function GalleryStrip() {
  const [shots, setShots] = useState<Shot[]>(fallbackShots);
  const [counts, setCounts] = useState<{ albums: number; photos: number } | null>(
    null
  );

  useEffect(() => {
    getGalleryHighlights(5)
      .then((data) => {
        if (data.media.length > 0) setShots(data.media);
        if (data.photoCount > 0) {
          setCounts({ albums: data.albumCount, photos: data.photoCount });
        }
      })
      .catch((error) => console.error("Failed to load gallery highlights:", error));
  }, []);

  return (
    <section className="relative overflow-hidden bg-surface-1 py-24 md:py-32">
      <Container>
        <motion.div
          className="mb-12 flex flex-col justify-between gap-8 md:flex-row md:items-end"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="max-w-2xl">
            <Eyebrow>Gallery</Eyebrow>
            <SectionTitle className="mt-6">
              Photo <Accent>Gallery</Accent>
            </SectionTitle>
            <SectionLead className="mt-5 max-w-lg">
              Every sadhya, every stage and every picnic since 2012 —
              photographed by whoever had a camera that day. Search by face to
              find yourself in there.
            </SectionLead>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-4 md:items-end">
            {counts && (
              <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Images className="h-3.5 w-3.5" strokeWidth={2} />
                {counts.albums} {counts.albums === 1 ? "album" : "albums"} ·{" "}
                {counts.photos} photos
              </span>
            )}
            <Link
              href="/gallery"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <span className="border-b border-foreground/30 pb-0.5 transition-colors group-hover:border-primary group-hover:text-primary">
                View all albums
              </span>
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          </div>
        </motion.div>

        {/* Mosaic: one hero frame carrying four squares. It only tiles cleanly
            with five images, so anything short of that falls back to an even
            row rather than leaving a hole in the grid. */}
        <motion.div
          className={cn(
            "grid grid-cols-2 gap-3 md:gap-4",
            shots.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3"
          )}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
        >
          {shots.slice(0, 5).map((shot, i) => (
            <motion.div
              key={shot.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.6, ease: EASE },
                },
              }}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted",
                i === 0 && shots.length >= 5 && "col-span-2 row-span-2"
              )}
            >
              <Link
                href={shot.albumId ? `/gallery/${shot.albumId}` : "/gallery"}
                className="absolute inset-0"
              >
                <img
                  src={shot.url}
                  alt={shot.caption || shot.albumTitle || "KSA gallery photograph"}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                {(shot.caption || shot.albumTitle) && (
                  <span className="absolute bottom-3 left-3 right-3 translate-y-2 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                    {shot.caption || shot.albumTitle}
                  </span>
                )}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
