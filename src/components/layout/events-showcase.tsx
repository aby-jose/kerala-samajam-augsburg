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
}

const fullDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const dayNum = (d: string) => String(new Date(d).getDate()).padStart(2, "0");

const monthShort = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { month: "short" });

export function EventsShowcase({ events }: EventsShowcaseProps) {
  const displayEvents = useMemo(() => events.slice(0, 4), [events]);
  const [selectedId, setSelectedId] = useState(displayEvents[0]?.id);
  const [isPaused, setIsPaused] = useState(false);

  // The list can be swapped underneath us (mock data → fetched events),
  // which would otherwise leave the rail with nothing highlighted.
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
      className="grid items-stretch gap-6 lg:grid-cols-12 lg:gap-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ---------- Featured event ---------- */}
      <div className="group relative overflow-hidden rounded-3xl border border-border bg-zinc-900 aspect-4/5 sm:aspect-16/10 lg:col-span-7 lg:aspect-16/11">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedEvent.id}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <img
              src={selectedEvent.image}
              alt={selectedEvent.title}
              className="absolute inset-0 h-full w-full object-cover brightness-[0.55] transition-transform duration-[2500ms] ease-out group-hover:scale-105"
            />
            {/* Bottom-weighted scrim so the type sits on solid darkness */}
            <div className="absolute inset-0 bg-linear-to-t from-black via-black/55 to-transparent" />
            <div className="absolute inset-0 bg-linear-to-r from-black/70 to-transparent" />

            <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 md:p-10">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                  {fullDate(selectedEvent.date)}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  <MapPin className="h-3 w-3" strokeWidth={2} />
                  {selectedEvent.location}
                </span>
              </div>

              <h3 className="mt-5 max-w-xl font-sans text-2xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white text-balance md:text-3xl lg:text-[2rem]">
                {selectedEvent.title}
              </h3>

              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/65 line-clamp-2">
                {selectedEvent.description}
              </p>

              <div className="mt-7 flex flex-col items-start gap-6 border-t border-white/10 pt-6 sm:flex-row sm:items-end sm:justify-between">
                <Countdown targetDate={selectedEvent.date} />
                <Link href={`/events/${selectedEvent.slug ?? selectedEvent.id}`}>
                  <Button className="h-11 rounded-full px-7 text-[11px] font-bold uppercase tracking-[0.18em] shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5">
                    Details
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Manual navigation */}
        {displayEvents.length > 1 && (
          <div className="absolute right-5 top-5 z-20 flex gap-2 sm:right-6 sm:top-6">
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                aria-label={dir === -1 ? "Previous event" : "Next event"}
                onClick={() => step(dir)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white backdrop-blur-md transition-all duration-300 hover:bg-white/15 active:scale-95"
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

      {/* ---------- Upcoming rail ---------- */}
      <div className="flex flex-col lg:col-span-5">
        <span className="mb-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <span className="h-px w-6 bg-border" />
          Up next
        </span>

        <ul className="flex flex-1 flex-col divide-y divide-border border-y border-border">
          {displayEvents.map((event) => {
            const active = event.id === selectedEvent.id;
            return (
              <li key={event.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => setSelectedId(event.id)}
                  aria-current={active}
                  className={cn(
                    "group flex h-full w-full min-h-[84px] items-center gap-4 px-4 py-4 text-left transition-colors duration-300 -mx-4 sm:-mx-5 sm:px-5",
                    active ? "bg-primary/[0.05]" : "hover:bg-foreground/[0.03]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border transition-colors duration-300",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface-1 text-foreground group-hover:border-primary/40"
                    )}
                  >
                    <span className="font-sans text-lg font-extrabold leading-none tracking-[-0.03em]">
                      {dayNum(event.date)}
                    </span>
                    <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] opacity-70">
                      {monthShort(event.date)}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate font-sans text-[15px] font-bold tracking-[-0.01em] transition-colors",
                        active ? "text-primary" : "text-foreground"
                      )}
                    >
                      {event.title}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" strokeWidth={2} />
                      <span className="truncate">{event.location}</span>
                    </span>
                  </span>

                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 transition-all duration-300",
                      active
                        ? "text-primary"
                        : "-translate-x-1 text-muted-foreground opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
