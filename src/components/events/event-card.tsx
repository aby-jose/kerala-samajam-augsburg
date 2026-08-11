import React from "react";
import { motion } from "framer-motion";
import { MapPin, CalendarDays, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface EventCardProps {
  event: {
    id: string;
    slug: string;
    title: string;
    date: string;
    location: string;
    description: string;
    image: string;
    category?: string;
  };
}

/**
 * A calendar entry in the grid below the spotlight. Same type voice as the
 * rest of the site — Manrope bold headings, 10px/0.2em uppercase metadata —
 * so the grid reads as a continuation of the card above it, not a second
 * design.
 */
export function EventCard({ event }: EventCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="group"
    >
      <Link href={`/events/${event.slug}`} className="block space-y-6">
        <div className="relative aspect-4/3 overflow-hidden rounded-3xl border border-border bg-zinc-900 shadow-sm transition-all duration-700 group-hover:-translate-y-1.5 group-hover:shadow-2xl">
          {/* The frame stays a fixed ratio so the grid stays aligned, but the
              poster inside it is never cropped — a blurred copy of the same
              artwork fills whatever the contained image does not. */}
          <img
            src={event.image}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl"
          />
          <img
            src={event.image}
            alt={event.title}
            loading="lazy"
            decoding="async"
            className="relative h-full w-full object-contain transition-transform duration-1000 group-hover:scale-[1.03]"
          />

          <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
            {event.category || "Event"}
          </span>

          {/* The date block echoes the ledger rows on /about — day over month,
              filling with primary as the card is hovered. */}
          <span className="absolute bottom-4 right-4 flex h-13 w-13 flex-col items-center justify-center rounded-xl border border-white/15 bg-black/45 backdrop-blur-md transition-colors duration-500 group-hover:border-primary group-hover:bg-primary">
            <span className="font-sans text-lg font-extrabold leading-none tracking-[-0.03em] text-white">
              {new Date(event.date).getDate().toString().padStart(2, "0")}
            </span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/70">
              {new Date(event.date).toLocaleDateString("en-GB", {
                month: "short",
              })}
            </span>
          </span>
        </div>

        <div className="space-y-4 px-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
              {formatDate(event.date)}
            </span>
            <span aria-hidden className="h-3.5 w-px bg-border" />
            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
              <span className="truncate">{event.location}</span>
            </span>
          </div>

          <div className="space-y-3">
            <h3 className="font-sans text-xl font-bold leading-snug tracking-[-0.025em] text-foreground text-balance transition-colors duration-300 group-hover:text-primary md:text-[1.375rem]">
              {event.title}
            </h3>
            <p className="line-clamp-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          </div>

          {/* Outlined, matching the spotlight CTA above — a hairline and the
              type, never a filled block. Its own footer row rather than one
              more grey line trailing the copy. */}
          <div className="border-t border-border pt-5">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-border bg-transparent px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground transition-all duration-300 group-hover:border-primary group-hover:text-primary">
              View Details
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2.4}
              />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
