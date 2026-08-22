"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Countdown } from "@/components/layout/countdown";
import { Button } from "@/components/ui/button";
import {
  Accent,
  Eyebrow,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import { getUpcomingEvents } from "@/lib/event-actions";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Rows shown here. The rest live on /events, linked from the footer of the list. */
const MAX_ROWS = 3;

interface BandEvent {
  id: string;
  slug: string | null;
  title: string;
  date: Date;
  location: string;
  image: string | null;
}

const dayNum = (d: Date) => String(d.getDate()).padStart(2, "0");
const monthShort = (d: Date) =>
  d.toLocaleDateString("en-GB", { month: "short" });
const weekday = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long" });
const clockTime = (d: Date) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

type UpcomingEvent = Awaited<ReturnType<typeof getUpcomingEvents>>[number];

/**
 * The closing band on /about: what is actually on the calendar.
 *
 * It sits on surface-deep so the page ends on the same dark note the home page
 * does, and the events read as a ledger — hairline rules, a date block per row
 * — rather than another card grid. The section is deliberately not a card
 * grid: /events already shows those, and this page has two grids above it.
 *
 * `events` arrives from the server component above (/about's page.tsx) rather
 * than being fetched here in a `useEffect` — that used to mean this band, and
 * every link to a registration page inside it, was missing from the HTML any
 * crawler actually saw.
 */
export function EventsBand({ events: upcoming }: { events: UpcomingEvent[] }) {
  const reduced = useReducedMotion();
  const events: BandEvent[] = React.useMemo(
    () =>
      upcoming.map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        date: new Date(e.date),
        location: e.location,
        image: e.imageUrl ?? null,
      })),
    [upcoming]
  );

  const rise: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  const stagger: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };

  const rows = events.slice(0, MAX_ROWS);
  const next = rows[0];
  const remaining = events.length - rows.length;
  // Snapshotted once rather than read fresh on every render — `Date.now()`
  // directly in the render body is an impure call the countdown itself
  // doesn't need: it re-ticks on its own timer regardless of this value.
  const [now] = React.useState(() => Date.now());

  return (
    <section className="relative overflow-hidden bg-surface-deep py-24 md:py-32">
      {/* Same ambient treatment as the join band on the home page, so the two
          dark sections read as one family. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/4 h-[460px] w-[620px] -translate-x-1/2 rounded-full bg-primary/15 blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
        }}
      />

      <Container className="relative max-w-7xl">
        <div className="grid grid-cols-1 gap-x-16 gap-y-14 lg:grid-cols-12">
          {/* ---------------- Pitch ---------------- */}
          <motion.div
            className="lg:col-span-5"
            variants={rise}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <Eyebrow tone="dark">Events</Eyebrow>

            <SectionTitle tone="dark" className="mt-6">
              What&apos;s <Accent>Coming Up</Accent>
            </SectionTitle>

            <SectionLead tone="dark" className="mt-6 max-w-md">
              Festivals, workshops and gatherings already on the calendar.
              Most are open to everyone — members just hear about them first.
            </SectionLead>

            {/* The nearest date, counted down. Hidden once it is in the past
                so the label never sits above an empty clock. */}
            {next &&
              next.date.getTime() > now &&
              (next.image ? (
                /* Everything rides on the poster itself — a card underneath it
                   would only repeat what the artwork already says. The shade is
                   kept to the bottom third so the poster stays readable. */
                <Link
                  href={`/events/${next.slug ?? next.id}`}
                  className="group relative mt-10 block overflow-hidden rounded-[1.5rem] border border-white/10"
                >
                  {/* No aspect box and no object-cover: posters carry dates,
                      prices and a venue, so the frame takes its height from the
                      artwork rather than cropping it to a ratio. */}
                  <img
                    src={next.image}
                    alt={next.title}
                    loading="lazy"
                    decoding="async"
                    className="block h-auto w-full transition-transform duration-[1400ms] ease-out group-hover:scale-[1.03]"
                  />
                  {/* A fixed band rather than a share of the frame, so a tall
                      poster is not shaded further up than a short one. */}
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-44 bg-linear-to-t from-black/90 via-black/50 via-35% to-transparent"
                  />

                  <span className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur-md">
                    Next up
                  </span>

                  <div className="absolute inset-x-5 bottom-5">
                    <p className="line-clamp-2 font-sans text-base font-bold leading-snug tracking-[-0.015em] text-white sm:text-lg">
                      {next.title}
                    </p>
                    <Countdown
                      targetDate={next.date}
                      size="sm"
                      className="mt-3.5"
                    />
                  </div>
                </Link>
              ) : (
                <div className="mt-10 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Next up
                  </span>
                  <p className="mt-2.5 font-sans text-lg font-bold leading-snug tracking-[-0.015em] text-white">
                    {next.title}
                  </p>
                  <Countdown targetDate={next.date} className="mt-6" />
                </div>
              ))}

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/events" className="group w-full sm:w-auto">
                <Button className="h-12 w-full rounded-full px-8 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 sm:w-auto">
                  Full Calendar
                  <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/contact" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  className="h-12 w-full rounded-full border border-white/15 bg-white/[0.06] px-8 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/15 hover:text-white sm:w-auto"
                >
                  Ask About One
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* ---------------- The ledger ---------------- */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                <span className="h-px w-6 bg-white/20" />
                On the calendar
              </span>
              {events.length > 0 && (
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/30">
                  {String(events.length).padStart(2, "0")} SCHEDULED
                </span>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="mt-6 flex flex-col items-start gap-5 rounded-[1.5rem] border border-dashed border-white/15 px-7 py-12">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/60">
                  <CalendarDays className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <div>
                  <p className="font-sans text-lg font-bold tracking-[-0.015em] text-white">
                    Nothing scheduled yet
                  </p>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/55">
                    New dates usually go up a few weeks ahead. Drop us a line
                    and we will tell you what is being planned.
                  </p>
                </div>
              </div>
            ) : (
              <motion.ul
                className="mt-2"
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
              >
                {rows.map((event) => (
                  <motion.li key={event.id} variants={rise}>
                    <Link
                      href={`/events/${event.slug ?? event.id}`}
                      className="group relative -mx-4 flex items-center gap-5 border-t border-white/10 px-4 py-7 transition-colors duration-300 hover:bg-white/[0.03] sm:gap-6"
                    >
                      {/* The rule redraws in primary on hover — same gesture
                          as the "What we do" index on the home page. */}
                      <span
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-x-100"
                      />

                      <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] transition-colors duration-300 group-hover:border-primary group-hover:bg-primary">
                        <span className="font-sans text-lg font-extrabold leading-none tracking-[-0.03em] text-white">
                          {dayNum(event.date)}
                        </span>
                        <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/60 transition-colors duration-300 group-hover:text-white/80">
                          {monthShort(event.date)}
                        </span>
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-sans text-[17px] font-bold tracking-[-0.015em] text-white">
                          {event.title}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/50">
                          <span className="whitespace-nowrap">
                            {weekday(event.date)}, {clockTime(event.date)}
                          </span>
                          <span aria-hidden className="h-3 w-px bg-white/15" />
                          <span className="flex min-w-0 items-center gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0" strokeWidth={2} />
                            <span className="truncate">{event.location}</span>
                          </span>
                        </span>
                      </span>

                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 transition-all duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                        <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                      </span>
                    </Link>
                  </motion.li>
                ))}

                {/* Never let the list imply it is the whole calendar. */}
                <li className="border-t border-white/10">
                  <Link
                    href="/events"
                    className="group flex items-center justify-between py-6 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 transition-colors duration-300 hover:text-white"
                  >
                    {remaining > 0
                      ? `${remaining} more on the calendar`
                      : "See every event"}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </li>
              </motion.ul>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
