"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/container";
import { EventCard } from "@/components/events/event-card";
import { EventsShowcase } from "@/components/layout/events-showcase";
import { Button } from "@/components/ui/button";
import {
  Eyebrow,
  PageHeader,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import { getUpcomingEvents } from "@/lib/event-actions";
import type { ListingsContentT } from "@/lib/page-content/listings";
import { withAccent } from "@/components/layout/with-accent";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * How many events the spotlight rotates through. Everything past this falls
 * to the grid below, so no event is ever shown twice on the page.
 */
const SPOTLIGHT_COUNT = 4;

type UpcomingEvent = Awaited<ReturnType<typeof getUpcomingEvents>>[number];

export function EventsClient({ content }: { content: ListingsContentT }) {
  const reduced = useReducedMotion();
  const [events, setEvents] = React.useState<UpcomingEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchEvents = async () => {
      try {
        setEvents(await getUpcomingEvents());
      } catch (error) {
        console.error("Failed to load events:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Server order is date-ascending. The one flagged featured jumps the queue
  // so it opens the spotlight; everything else keeps its date order.
  const ordered = React.useMemo(() => {
    const featured = events.find((e) => e.isFeatured);
    return featured
      ? [featured, ...events.filter((e) => e.id !== featured.id)]
      : events;
  }, [events]);

  const spotlight = ordered.slice(0, SPOTLIGHT_COUNT);
  const rest = ordered.slice(SPOTLIGHT_COUNT);

  const rise: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  const stagger: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };

  return (
    <main className="flex min-h-screen flex-col bg-background selection:bg-primary/5">
      {/* ============ 1. Header + spotlight — surface 1 ============ */}
      <section className="bg-surface-1 pb-20 pt-40">
        <Container className="max-w-7xl">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={rise}
            className="space-y-14"
          >
            <PageHeader
              eyebrow={content.eventsHero.eyebrow}
              title={withAccent(content.eventsHero.title, content.eventsHero.accentWord)}
              lead={content.eventsHero.lead}
            />

            {/* The same spotlight the home page uses: rotation, countdown and
                the empty state all live inside the component. */}
            <EventsShowcase
              isLoading={isLoading}
              events={spotlight.map((e) => ({
                id: e.id,
                slug: e.slug,
                title: e.title,
                date: e.date.toISOString(),
                location: e.location,
                description: e.description,
                image: e.imageUrl || "/images/placeholder.svg",
              }))}
            />
          </motion.div>
        </Container>
      </section>

      {/* ============ 2. The rest of the calendar — surface 2 ============ */}
      {/* Hidden entirely when the spotlight already covers everything, rather
          than printing a heading over an empty grid. */}
      {rest.length > 0 && (
        <section className="border-y border-border bg-surface-2 py-24 md:py-32">
          <Container className="max-w-7xl">
            <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div className="max-w-xl">
                <Eyebrow>{content.eventsCalendar.eyebrow}</Eyebrow>
                <SectionTitle className="mt-6">
                  {withAccent(content.eventsCalendar.title, content.eventsCalendar.accentWord)}
                </SectionTitle>
              </div>
              <SectionLead className="max-w-sm md:text-right">
                {content.eventsCalendar.lead}
              </SectionLead>
            </div>

            <motion.div
              className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3 lg:gap-14"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              {rest.map((event) => (
                <EventCard
                  key={event.id}
                  event={{
                    ...event,
                    date: event.date.toISOString(),
                    image: event.imageUrl || "/images/placeholder.svg",
                    category: event.category ?? undefined,
                  }}
                />
              ))}
            </motion.div>
          </Container>
        </section>
      )}

      {/* ============ 3. Closing band — deep ============ */}
      {/* Same ambient treatment as the join band on the home page and the
          events band on /about, so the three pages end on one note. */}
      <section className="relative overflow-hidden bg-surface-deep py-24 md:py-32">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
            backgroundSize: "28px 28px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
          }}
        />

        <Container className="relative">
          <motion.div
            className="mx-auto max-w-3xl text-center"
            variants={rise}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="flex justify-center">
              <Eyebrow tone="dark">{content.eventsMembersBand.eyebrow}</Eyebrow>
            </div>

            <SectionTitle tone="dark" className="mt-7">
              {withAccent(content.eventsMembersBand.title, content.eventsMembersBand.accentWord)}
            </SectionTitle>

            <SectionLead tone="dark" className="mx-auto mt-6 max-w-xl">
              {content.eventsMembersBand.lead}
            </SectionLead>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/membership" className="group w-full sm:w-auto">
                <Button className="h-12 w-full rounded-full px-9 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 sm:w-auto">
                  Become a Member
                  <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/contact" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  className="h-12 w-full rounded-full border border-white/15 bg-white/[0.06] px-9 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/15 hover:text-white sm:w-auto"
                >
                  Ask About an Event
                </Button>
              </Link>
            </div>
          </motion.div>
        </Container>
      </section>
    </main>
  );
}
