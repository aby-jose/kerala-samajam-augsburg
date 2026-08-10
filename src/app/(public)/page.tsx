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

// Placeholder events, shown until the real calendar loads. Past ones are
// filtered out below, same as the live data.
const mockEvents = [
  {
    id: "1",
    title: "Grand Onam Celebration 2026",
    date: "2026-08-30T10:00:00",
    location: "Augsburg Community Hall",
    description: "Experience the vibrant spirit of Kerala with traditional Pookalam, grand Onasadhya, and cultural performances that bring our heritage to life in the heart of Augsburg.",
    image: "/images/events/onam-celebration.png",
  },
  {
    id: "2",
    title: "Kerala Traditional Music Night",
    date: "2026-05-15T18:00:00",
    location: "Kulturhaus Abraxas",
    description: "An evening of soul-stirring rhythms featuring traditional instruments like Chenda and Mridangam, blending classical Kerala music with modern artistic expressions.",
    image: "/images/events/music-night.png",
  },
  {
    id: "3",
    title: "Traditional Arts Workshop",
    date: "2026-06-20T14:00:00",
    location: "KSA Cultural Center",
    description: "A hands-on workshop dedicated to preserving Kerala's unique arts. Learn the intricate techniques of Kathakali mask making and traditional mural painting from experts.",
    image: "/images/events/traditional-workshop.png",
  },
  {
    id: "4",
    title: "Summer Community Gathering",
    date: "2026-07-12T11:00:00",
    location: "Augsburg City Park",
    description: "Join your KSA family for a day of fun, food, and friendship. A perfect opportunity for the community to connect and celebrate together.",
    image: "/images/events/Summer.jpg",
  },
];

// Anything before today is done with — the showcase never displays it.
const isUpcoming = (date: string) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(date) >= startOfToday;
};

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>(() =>
    mockEvents.filter((e) => isUpcoming(e.date))
  );

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const realEvents = await getUpcomingEvents();
        // Map the real events to the format expected by the showcase.
        // An empty result is meaningful — it means nothing is scheduled —
        // so the placeholders are dropped either way.
        setUpcomingEvents(
          realEvents.slice(0, 4).map((e) => ({
            id: e.id,
            slug: e.slug,
            title: e.title,
            date: e.date.toISOString(),
            location: e.location,
            description: e.description,
            image: e.imageUrl || "/images/placeholder.jpg",
          }))
        );
      } catch (error) {
        console.error("Failed to fetch real events:", error);
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

          <EventsShowcase events={upcomingEvents} />
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
