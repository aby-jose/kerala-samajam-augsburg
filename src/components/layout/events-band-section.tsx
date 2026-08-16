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
import { cn } from "@/lib/utils";

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
  surface = "bg-surface-2",
  bordered = true,
}: {
  events: EventCard[];
  surface?: string;
  bordered?: boolean;
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
    <section
      className={cn(
        "relative overflow-hidden py-24 md:py-32",
        surface,
        bordered && "border-y border-border"
      )}
    >
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

        {events.length > 0 ? (
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
