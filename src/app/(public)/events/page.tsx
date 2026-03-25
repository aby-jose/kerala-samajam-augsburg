"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { Container } from "@/components/layout/container";
import { EventCard } from "@/components/events/event-card";
import { Countdown } from "@/components/layout/countdown";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

// Synchronized events list from the home page
const allEvents = [
  {
    id: "1",
    title: "Grand Onam Celebration 2026",
    date: "2026-08-30T10:00:00",
    location: "Augsburg Community Hall",
    description: "Experience the vibrant spirit of Kerala with traditional Pookalam, grand Onasadhya, and cultural performances that bring our heritage to life in the heart of Augsburg.",
    image: "/images/events/onam-celebration.png",
    category: "Festival",
  },
  {
    id: "2",
    title: "Kerala Traditional Music Night",
    date: "2026-05-15T18:00:00",
    location: "Kulturhaus Abraxas",
    description: "An evening of soul-stirring rhythms featuring traditional instruments like Chenda and Mridangam, blending classical Kerala music with modern artistic expressions.",
    image: "/images/events/music-night.png",
    category: "Music",
  },
  {
    id: "3",
    title: "Traditional Arts Workshop",
    date: "2026-06-20T14:00:00",
    location: "KSA Cultural Center",
    description: "A hands-on workshop dedicated to preserving Kerala's unique arts. Learn the intricate techniques of Kathakali mask making and traditional mural painting from experts.",
    image: "/images/events/traditional-workshop.png",
    category: "Workshop",
  },
  {
    id: "4",
    title: "Summer Community Gathering",
    date: "2026-07-12T11:00:00",
    location: "Augsburg City Park",
    description: "Join your KSA family for a day of fun, food, and friendship. A perfect opportunity for the community to connect and celebrate together.",
    image: "/images/events/summer.jpg",
    category: "Social",
  },
];

export default function EventsPage() {
  const featuredEvent = allEvents[0];
  const gridEvents = allEvents.slice(1);

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
      
      {/* 1. Centered Editorial Header (7xl) */}
      <section className="pt-40 pb-20 bg-background">
        <Container className="max-w-7xl">
           <motion.div
             initial="hidden"
             animate="visible"
             variants={revealVariants}
             className="text-center space-y-12"
           >
              {/* Centered Typography */}
              <div className="space-y-6 max-w-4xl mx-auto">
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.5em] block">The Community Milestone Hub</span>
                <h1 className="text-4xl md:text-6xl font-serif font-medium leading-[1.05] tracking-tight text-foreground">
                   Cultural <span className="text-primary italic">Experiences</span> <br />
                   in Augsburg.
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-light max-w-2xl mx-auto pt-4">
                   Discover our curated collection of cultural programs, traditional festivals, and community gatherings dedicated to preserving Kerala's heritage in Germany.
                </p>
              </div>

              {/* Master Showcase Card (Centered 7xl) */}
              <motion.div 
                className="relative rounded-[2.5rem] overflow-hidden bg-zinc-900 shadow-3xl border border-white/5 aspect-21/9 md:aspect-2.5/1 group"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                 <img 
                   src={featuredEvent.image} 
                   alt={featuredEvent.title} 
                   className="absolute inset-0 object-cover w-full h-full brightness-[0.6] group-hover:scale-105 transition-transform duration-2000 ease-out"
                 />
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
                          <Countdown targetDate={featuredEvent.date} className="scale-75 md:scale-95 origin-left text-white" />
                          <Link href={`/events/${featuredEvent.id}`}>
                             <Button size="sm" className="h-12 px-10 text-[10px] font-bold rounded-full bg-primary hover:bg-primary/90 text-white uppercase tracking-[0.3em] shadow-xl hover:-translate-y-1 transition-all active:scale-[0.98]">
                                Register Now
                                <ArrowRight className="ml-2 w-4 h-4" />
                             </Button>
                          </Link>
                       </div>
                    </div>
                 </div>
              </motion.div>
           </motion.div>
        </Container>
      </section>

      {/* 2. Professional Events Grid (7xl Center Balanced) */}
      <section className="py-24 bg-background border-t border-border/5">
        <Container className="max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 justify-between items-end mb-20 gap-8">
            <div className="max-w-xl space-y-4">
               <span className="text-[10px] font-bold text-primary uppercase tracking-[0.4em] block">Cultural Calendar</span>
               <h2 className="text-3xl md:text-5xl font-serif font-medium leading-tight text-foreground tracking-tight">
                  Upcoming <span className="text-primary italic">Highlights</span>
               </h2>
            </div>
            <p className="text-sm text-muted-foreground/80 max-w-xs border-l border-primary/30 pl-8 md:pl-8 py-1 font-light leading-relaxed md:justify-self-end">
               Discover our collection of cultural programs and community gatherings in Augsburg.
            </p>
          </div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-14"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {gridEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </motion.div>
          
          {allEvents.length === 0 && (
            <motion.div 
              className="text-center py-32 border border-dashed border-border/40 rounded-[3rem] bg-muted/20"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
            >
              <h3 className="text-xl font-serif font-medium mb-2 text-foreground">No upcoming events found</h3>
              <p className="text-sm text-muted-foreground font-light">Check back soon for our next cultural milestone.</p>
            </motion.div>
          )}
        </Container>
      </section>
    </main>
  );
}
