"use client";

import { motion, Variants } from "framer-motion";
import { EventsShowcase } from "@/components/layout/events-showcase";
import { Container } from "@/components/layout/container";
import {
  Accent,
  Eyebrow,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

// Exported so home-page-client.tsx types its `events` prop from one place.
export interface EventCard {
  id: string;
  slug: string;
  title: string;
  date: string;
  location: string;
  description: string;
  image: string;
}

export function EventsBandSection({
  events,
  isLoading = false,
}: {
  events: EventCard[];
  isLoading?: boolean;
}) {
  const revealVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 50, damping: 20, duration: 0.8 }
    },
  };

  return (
    <section className="relative overflow-hidden border-y border-border bg-surface-2 py-24 md:py-32">
      <Container>
        <motion.div
          className="mb-12 flex flex-col justify-between gap-8 md:flex-row md:items-end"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={revealVariants}
        >
          <div className="max-w-2xl">
            <Eyebrow>Events</Eyebrow>
            <SectionTitle className="mt-6">
              Upcoming <Accent>Events</Accent>
            </SectionTitle>
            <SectionLead className="mt-5 max-w-lg">
              Everything on the calendar right now. Members hear about new
              dates first, and everyone is welcome at most of them.
            </SectionLead>
          </div>
          <Link href="/events" className="shrink-0">
            <Button
              variant="outline"
              className="h-12 rounded-full border-border bg-surface-1 px-8 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              Full Calendar
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </Link>
        </motion.div>

        {isLoading ? (
          <div
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            aria-busy="true"
            aria-label="Loading upcoming events"
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface-1">
                <div className="aspect-[4/3] animate-pulse bg-muted" />
                <div className="space-y-3 p-5">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length > 0 ? (
          <EventsShowcase events={events} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-surface-1 px-6 py-16 text-center">
            <p className="text-base font-semibold text-foreground">
              Nothing on the calendar just yet
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              New dates are announced here first — members hear about them by email.
            </p>
          </div>
        )}
      </Container>
    </section>
  );
}
