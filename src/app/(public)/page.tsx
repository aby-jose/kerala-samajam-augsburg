"use client";

import { motion, Variants } from "framer-motion";
import { Hero } from "@/components/layout/hero";
import { AboutIntro } from "@/components/layout/about-intro";
import { EventsShowcase } from "@/components/layout/events-showcase";
import { GalleryStrip } from "@/components/layout/gallery-strip";
import { LeadershipRow } from "@/components/layout/leadership-row";
import { JoinSteps } from "@/components/layout/join-steps";
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

import React, { useState, useEffect } from "react";
import { getUpcomingEvents } from "@/lib/event-actions";

export default function Home() {
  // Starts empty rather than seeded with invented events.
  //
  // This used to render four hardcoded events — with titles, dates and venues
  // — until the real calendar arrived a moment later. To a visitor those were
  // indistinguishable from the genuine programme, so the homepage briefly
  // advertised gatherings that had never been scheduled. A skeleton says
  // "loading"; a fake Onam celebration at a named hall says something untrue.
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const realEvents = await getUpcomingEvents();
        setUpcomingEvents(
          realEvents.slice(0, 4).map((e) => ({
            id: e.id,
            slug: e.slug,
            title: e.title,
            date: e.date.toISOString(),
            location: e.location,
            description: e.description,
            image: e.imageUrl || "/images/placeholder.svg",
          }))
        );
      } catch (error) {
        console.error("Failed to fetch real events:", error);
      } finally {
        setIsLoadingEvents(false);
      }
    };
    fetchEvents();
  }, []);
  const revealVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 50, damping: 20, duration: 0.8 }
    },
  };

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Hero />

      {/* ================= Who we are — surface 1 ================= */}
      <AboutIntro />

      {/* ================= Events — surface 2 ================= */}
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

          {isLoadingEvents ? (
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
          ) : upcomingEvents.length > 0 ? (
            <EventsShowcase events={upcomingEvents} />
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

      {/* ================= Gallery — surface 1 ================= */}
      <GalleryStrip />

      {/* ================= Committee — surface 3 ================= */}
      <LeadershipRow />

      {/* ================= How to join — surface 1 ================= */}
      <JoinSteps />

      {/* ================= Join — deep band ================= */}
      <section className="relative overflow-hidden bg-surface-deep py-28 md:py-36">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
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
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={revealVariants}
          >
            <div className="flex justify-center">
              <Eyebrow tone="dark">Join us</Eyebrow>
            </div>

            <SectionTitle tone="dark" className="mt-7 md:text-5xl">
              Become a Member of <Accent>KSA</Accent>
            </SectionTitle>

            <SectionLead tone="dark" className="mx-auto mt-6 max-w-xl">
              Join the families who keep this going — and get every invitation,
              every class and every celebration for the year ahead.
            </SectionLead>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/membership" className="group w-full sm:w-auto">
                <Button className="h-12 w-full rounded-full px-9 text-[14px] font-bold shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 sm:w-auto">
                  Apply for Membership
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/contact" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  className="h-12 w-full rounded-full border border-white/15 bg-white/[0.06] px-9 text-[14px] font-semibold text-white backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/15 hover:text-white sm:w-auto"
                >
                  Ask a Question First
                </Button>
              </Link>
            </div>
          </motion.div>
        </Container>
      </section>
    </main>
  );
}
