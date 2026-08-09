"use client";

import React, { useEffect, useState } from "react";
import { motion, Variants } from "framer-motion";
import { Container } from "@/components/layout/container";
import { EventCard } from "@/components/events/event-card";
import { Countdown } from "@/components/layout/countdown";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Loader2, Calendar } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { getUpcomingEvents } from "@/lib/event-actions";
import {
  Accent,
  Eyebrow,
  PageHeader,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await getUpcomingEvents();
        setEvents(data);
      } catch (error) {
        console.error("Failed to load events:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const featuredEvent = events.find(e => e.isFeatured) || events[0];
  const gridEvents = featuredEvent ? events.filter(e => e.id !== featuredEvent.id) : events;

  const revealVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } 
    },
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { staggerChildren: 0.1, delayChildren: 0.1 } 
    },
  };

  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/5">
      
      {/* 1. Page header — surface 1 */}
      <section className="pt-40 pb-20 bg-surface-1">
        <Container className="max-w-7xl">
           <motion.div
             initial="hidden"
             animate="visible"
             variants={revealVariants}
             className="space-y-12"
           >
              <PageHeader
                eyebrow="Events"
                title={<>Upcoming <Accent>Events</Accent></>}
                lead="Festivals, workshops and gatherings that are still to come. Most are open to everyone — bring a friend, and bring an appetite."
              />

              {/* Master Showcase Card (Centered 7xl) */}
              {isLoading && (
                <div className="flex aspect-21/9 md:aspect-2.5/1 w-full items-center justify-center rounded-[2.5rem] border border-border bg-muted/30">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                </div>
              )}

              {!isLoading && featuredEvent && (
                <motion.div 
                  className="relative rounded-[2.5rem] overflow-hidden bg-zinc-900 shadow-3xl border border-white/5 aspect-21/9 md:aspect-2.5/1 group"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {featuredEvent.imageUrl && (
                    <img 
                      src={featuredEvent.imageUrl} 
                      alt={featuredEvent.title} 
                      className="absolute inset-0 object-cover w-full h-full brightness-[0.6] group-hover:scale-105 transition-transform duration-2000 ease-out"
                    />
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {/* Content Overlay */}
                  <div className="absolute inset-0 p-8 md:p-14 flex flex-col justify-end gap-6 md:gap-8 text-left">
                      <div className="max-w-3xl space-y-4 md:space-y-6">
                        <div className="flex flex-wrap items-center gap-4">
                            <span className="px-4 py-1.5 rounded-full bg-primary/20 text-primary-foreground text-[10px] font-bold tracking-[0.3em] uppercase backdrop-blur-md border border-white/10">
                              {formatDate(featuredEvent.date)}
                            </span>
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-primary" />
                              {featuredEvent.location}
                            </span>
                        </div>
                        
                        <h3 className="text-3xl md:text-5xl lg:text-6xl font-serif font-medium text-white leading-[1.05] tracking-tight">
                            {featuredEvent.title}
                        </h3>
                        
                        <p className="text-sm md:text-base text-white/50 leading-relaxed font-light line-clamp-1 max-w-xl">
                            {featuredEvent.description}
                        </p>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-10 pt-8 border-t border-white/10">
                            <Countdown targetDate={featuredEvent.date} />
                            <Link href={`/events/${featuredEvent.slug}`}>
                              <Button size="sm" className="h-12 px-10 text-[10px] font-bold rounded-full bg-primary hover:bg-primary/90 text-white uppercase tracking-[0.3em] shadow-xl hover:-translate-y-1 transition-all active:scale-[0.98]">
                                  Register Now
                                  <ArrowRight className="ml-2 w-4 h-4" />
                              </Button>
                            </Link>
                        </div>
                      </div>
                  </div>
                </motion.div>
              )}
           </motion.div>
        </Container>
      </section>

      {/* 2. Events grid — surface 2 */}
      <section className="py-24 md:py-32 bg-surface-2 border-y border-border">
        <Container className="max-w-7xl">
          <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-xl">
               <Eyebrow>Calendar</Eyebrow>
               <SectionTitle className="mt-6">
                  What&apos;s <Accent>Coming Up</Accent>
               </SectionTitle>
            </div>
            <SectionLead className="max-w-sm md:text-right">
               Dates, places and what to expect. Registration opens on each
               event&apos;s own page.
            </SectionLead>
          </div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-14"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {gridEvents.map((event) => (
              <EventCard key={event.id} event={{
                ...event,
                image: event.imageUrl // Map database field to component prop
              }} />
            ))}
          </motion.div>
          
          {!isLoading && events.length === 0 && (
            <motion.div 
              className="text-center py-32 border border-dashed border-border/40 rounded-[3rem] bg-muted/20"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
            >
              <div className="h-24 w-24 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <h3 className="mb-2 font-sans text-xl font-bold tracking-[-0.02em] text-foreground">No Events Scheduled</h3>
              <p className="text-sm text-muted-foreground">Nothing is on the calendar just yet. New dates usually go up a few weeks ahead.</p>
            </motion.div>
          )}
        </Container>
      </section>
    </main>
  );
}
