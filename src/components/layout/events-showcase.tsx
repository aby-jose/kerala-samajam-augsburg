"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Countdown } from "./countdown";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  slug?: string;
  title: string;
  date: string;
  location: string;
  description: string;
  image: string;
}

interface EventsShowcaseProps {
  events: Event[];
  /**
   * Show a skeleton rather than the "nothing scheduled" card while the
   * calendar is still in flight. Pages that seed with placeholder events
   * (the home page) never need this; pages that start empty do.
   */
  isLoading?: boolean;
}

const fullDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function EventsShowcase({ events, isLoading }: EventsShowcaseProps) {
  const displayEvents = useMemo(() => events.slice(0, 4), [events]);
  const [selectedId, setSelectedId] = useState(displayEvents[0]?.id);
  const [isPaused, setIsPaused] = useState(false);

  // The list can be swapped underneath us (mock data → fetched events),
  // which would otherwise leave the card pointing at an event that is gone.
  useEffect(() => {
    if (!displayEvents.some((e) => e.id === selectedId)) {
      setSelectedId(displayEvents[0]?.id);
    }
  }, [displayEvents, selectedId]);

  const step = (dir: 1 | -1) => {
    setSelectedId((current) => {
      const i = displayEvents.findIndex((e) => e.id === current);
      const next = (i + dir + displayEvents.length) % displayEvents.length;
      return displayEvents[next]?.id;
    });
  };

  useEffect(() => {
    if (isPaused || displayEvents.length < 2) return;
    const timer = setInterval(() => step(1), 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, displayEvents]);

  const selectedEvent =
    displayEvents.find((e) => e.id === selectedId) || displayEvents[0];
  const currentIndex = Math.max(
    displayEvents.findIndex((e) => e.id === selectedEvent?.id),
    0
  );

  // Still fetching. Hold the exact shape of the card so the page does not
  // jump, and so "No Events Scheduled" never flashes before the data lands.
  if (isLoading && !selectedEvent) {
    return (
      <div className="h-[560px] w-full animate-pulse rounded-3xl border border-border bg-muted/40 lg:h-[520px]" />
    );
  }

  // Nothing upcoming. Say so plainly rather than collapsing the section.
  if (!selectedEvent) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-border px-6 py-20 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-1 text-muted-foreground">
          <CalendarDays className="h-5 w-5" strokeWidth={1.6} />
        </span>
        <div>
          <p className="font-sans text-lg font-bold tracking-[-0.015em] text-foreground">
            No Events Scheduled
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing is on the calendar just yet. New dates are usually
            announced a few weeks ahead, and members hear about them first.
          </p>
        </div>
        <Link href="/contact">
          <Button
            variant="outline"
            className="h-11 rounded-full border-border px-7 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground"
          >
            Get in Touch
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ---------- Featured event ---------- */}
      {/* Two columns rather than a full-bleed crop. Event artwork is a poster
          — it carries the date, the price and the venue in the image itself —
          so it is shown whole and the type sits beside it, never on top of it.
          Same rule the event page and the /about band already follow. */}
      <div className="group relative overflow-hidden rounded-3xl border border-border bg-zinc-900">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedEvent.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* The poster doubles as its own backdrop, blurred well past
                legibility so it reads as colour only and the frame is never
                empty beside a narrow one. */}
            <img
              src={selectedEvent.image}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-45 blur-[70px]"
            />
            <div aria-hidden className="absolute inset-0 bg-black/60" />

            <div className="relative grid items-center gap-9 px-6 pb-14 pt-9 sm:px-9 lg:min-h-[520px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-12 lg:py-14">
              {/* ---- The poster, uncropped ---- */}
              {/* No aspect box and no object-cover: the height comes from the
                  artwork, capped so a very tall poster cannot run away with
                  the section. */}
              <Link
                href={`/events/${selectedEvent.slug ?? selectedEvent.id}`}
                className="flex justify-center lg:order-2"
              >
                <img
                  src={selectedEvent.image}
                  alt={selectedEvent.title}
                  className="block max-h-[320px] w-auto max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl shadow-black/60 transition-transform duration-[1200ms] ease-out group-hover:scale-[1.02] sm:max-h-[400px] lg:max-h-[440px]"
                />
              </Link>

              {/* ---- The pitch ---- */}
              <div className="lg:order-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                    {fullDate(selectedEvent.date)}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    <MapPin className="h-3 w-3" strokeWidth={2} />
                    {selectedEvent.location}
                  </span>
                </div>

                <h3 className="mt-5 font-sans text-2xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white text-balance md:text-4xl">
                  {selectedEvent.title}
                </h3>

                <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/65 line-clamp-3">
                  {selectedEvent.description}
                </p>

                <div className="mt-8 flex flex-col items-start gap-6 border-t border-white/10 pt-7 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
                  <Countdown targetDate={selectedEvent.date} />

                  {/* ml-auto, not just justify-between: the countdown only
                      exists after mount, and without it the lone button would
                      render hard left and then jump. */}
                  <Link
                    href={`/events/${selectedEvent.slug ?? selectedEvent.id}`}
                    className="group/cta shrink-0 sm:ml-auto"
                  >
                    <Button className="relative h-12 overflow-hidden rounded-full px-8 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/30 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/45">
                      {/* The pill is the only solid colour on the card, so it
                          gets the one flourish: a single light sweep on hover. */}
                      <span
                        aria-hidden
                        className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/25 to-transparent transition-transform duration-[900ms] ease-out group-hover/cta:translate-x-full"
                      />
                      <span className="relative flex items-center">
                        View Details
                        <ArrowRight
                          className="ml-2.5 h-3.5 w-3.5 transition-transform duration-500 group-hover/cta:translate-x-1"
                          strokeWidth={2.4}
                        />
                      </span>
                    </Button>
                  </Link>
                </div>

                {/* Sequential navigation. It lives in the type column rather
                    than floating in a corner — a corner control would sit on
                    the poster, which is the one thing this layout protects. */}
                {displayEvents.length > 1 && (
                  <div className="mt-8 flex items-center gap-4">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-white/50">
                      {String(currentIndex + 1).padStart(2, "0")} /{" "}
                      {String(displayEvents.length).padStart(2, "0")}
                    </span>
                    {([-1, 1] as const).map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        aria-label={dir === -1 ? "Previous event" : "Next event"}
                        onClick={() => step(dir)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white backdrop-blur-md transition-all duration-300 hover:bg-white/15 active:scale-95"
                      >
                        {dir === -1 ? (
                          <ChevronLeft className="h-4.5 w-4.5" />
                        ) : (
                          <ChevronRight className="h-4.5 w-4.5" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Direct jumps. A segmented rail along the bottom edge rather than
            dots in the corner — the corner belongs to the CTA now, and the
            rail reads as position without competing with anything. */}
        {displayEvents.length > 1 && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex gap-px">
            {displayEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedId(event.id)}
                aria-label={`Show ${event.title}`}
                aria-current={event.id === selectedEvent.id}
                className="group/seg flex-1 pt-4"
              >
                <span
                  className={cn(
                    "block h-[3px] w-full transition-colors duration-500",
                    event.id === selectedEvent.id
                      ? "bg-primary"
                      : "bg-white/20 group-hover/seg:bg-white/45"
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
