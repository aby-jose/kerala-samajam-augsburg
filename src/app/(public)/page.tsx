"use client";

import { Hero } from "@/components/layout/hero";
import { AboutIntro } from "@/components/layout/about-intro";
import { EventsBandSection } from "@/components/layout/events-band-section";
import { GalleryStrip } from "@/components/layout/gallery-strip";
import { LeadershipRow } from "@/components/layout/leadership-row";
import { JoinSteps } from "@/components/layout/join-steps";
import { JoinCta } from "@/components/layout/join-cta";

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

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Hero />

      {/* ================= Who we are — surface 1 ================= */}
      <AboutIntro />

      {/* ================= Events — surface 2 ================= */}
      <EventsBandSection events={upcomingEvents} isLoading={isLoadingEvents} />

      {/* ================= Gallery — surface 1 ================= */}
      <GalleryStrip />

      {/* ================= Committee — surface 3 ================= */}
      <LeadershipRow />

      {/* ================= How to join — surface 1 ================= */}
      <JoinSteps />

      {/* ================= Join — deep band ================= */}
      <JoinCta />
    </main>
  );
}
