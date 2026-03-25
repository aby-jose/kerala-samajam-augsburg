"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Calendar, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import Link from "next/link";
import { Countdown } from "./countdown";

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  image: string;
}

interface EventsShowcaseProps {
  events: Event[];
}

export function EventsShowcase({ events }: EventsShowcaseProps) {
  const [selectedId, setSelectedId] = useState(events[0]?.id);
  const [isPaused, setIsPaused] = useState(false);
  const selectedEvent = events.find((e) => e.id === selectedId) || events[0];
  const displayEvents = events.slice(0, 4);

  const handleNext = () => {
    const currentIndex = displayEvents.findIndex((e) => e.id === selectedId);
    const nextIndex = (currentIndex + 1) % displayEvents.length;
    setSelectedId(displayEvents[nextIndex].id);
  };

  const handlePrev = () => {
    const currentIndex = displayEvents.findIndex((e) => e.id === selectedId);
    const prevIndex = (currentIndex - 1 + displayEvents.length) % displayEvents.length;
    setSelectedId(displayEvents[prevIndex].id);
  };

  // Auto-carousel logic
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      handleNext();
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused, selectedId, displayEvents]);

  if (!selectedEvent) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div 
      className="relative max-w-7xl mx-auto group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 
          Master Showcase Card (Ultra-Wide on Large screens) 
          Using responsive aspect ratios for mobile/tablet optimization
      */}
      <div className="relative rounded-4xl overflow-hidden bg-zinc-900 shadow-2xl border border-white/5 aspect-4/5 xs:aspect-[5/4] sm:aspect-16/10 lg:aspect-2.5/1 transition-all duration-700">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedEvent.id}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <img 
              src={selectedEvent.image} 
              alt={selectedEvent.title} 
              className="absolute inset-0 object-cover w-full h-full brightness-[0.6] group-hover:scale-110 transition-transform duration-3000 ease-out"
            />
            <div className="absolute inset-0 bg-linear-to-r from-black/90 via-black/20 to-transparent" />
            
            {/* Content Panel (Reduced Scale) */}
            <div className="absolute inset-0 p-6 md:p-12 flex flex-col justify-end">
              <div className="max-w-xl space-y-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-primary/20 text-primary-foreground text-[9px] font-bold tracking-[0.3em] uppercase backdrop-blur-md border border-white/10">
                    {formatDate(selectedEvent.date)}
                  </span>
                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                    <MapPin className="w-2.5 h-2.5" />
                    {selectedEvent.location}
                  </span>
                </div>
                
                <h3 className="text-2xl md:text-3xl lg:text-4xl font-serif font-medium text-white leading-tight tracking-tight">
                  {selectedEvent.title}
                </h3>
                
                <p className="text-xs md:text-sm text-white/40 leading-relaxed italic line-clamp-2 max-w-md">
                  {selectedEvent.description}
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 pt-6 border-t border-white/5">
                  <Countdown targetDate={selectedEvent.date} className="scale-75 md:scale-90 origin-left text-white" />
                  <Link href={`/events/${selectedEvent.id}`}>
                    <Button size="sm" className="h-11 px-8 text-[10px] font-bold rounded-full bg-primary hover:bg-primary/90 text-white uppercase tracking-widest transition-all hover:translate-y-[-2px]">
                      Details
                      <ArrowRight className="ml-2 w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows (Master Card) */}
        <div className="absolute inset-y-0 left-4 md:left-8 flex items-center z-30 pointer-events-none">
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-95 pointer-events-auto opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
        <div className="absolute inset-y-0 right-4 md:right-8 flex items-center z-30 pointer-events-none">
          <button 
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-95 pointer-events-auto opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Floating Internal Navigation (Bottom-Right) */}
        <div className="absolute bottom-6 right-6 z-20 hidden md:flex items-center gap-3 p-2 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10">
          {displayEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedId(event.id)}
              className={`relative w-14 h-14 rounded-xl overflow-hidden transition-all duration-500 border-2 ${
                selectedId === event.id 
                ? "border-primary scale-110 shadow-lg shadow-primary/20" 
                : "border-transparent opacity-40 hover:opacity-100 hover:scale-105"
              }`}
            >
              <img src={event.image} alt={event.title} className="absolute inset-0 object-cover w-full h-full" />
              {selectedId === event.id && (
                <div className="absolute inset-0 bg-primary/10" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Modern External Dot Indicators (Bottom) */}
      <div className="flex justify-center gap-3 mt-10">
        {displayEvents.map((event) => (
          <button
            key={event.id}
            onClick={() => setSelectedId(event.id)}
            className="group py-2 px-1"
          >
            <motion.div
              animate={{
                width: selectedId === event.id ? 28 : 8,
                backgroundColor: "var(--color-primary)",
                opacity: selectedId === event.id ? 1 : 0.25,
                boxShadow: selectedId === event.id ? "0 0 15px rgba(193, 29, 69, 0.4)" : "none"
              }}
              className="h-1.5 rounded-full transition-all duration-500 group-hover:opacity-60 shadow-sm"
            />
          </button>
        ))}
      </div>

      {/* Mobile/Tablet Thumbnail Row (Visible on small screens) */}
      <div className="flex md:hidden gap-3 mt-4 overflow-x-auto no-scrollbar pb-2 px-1">
        {displayEvents.map((event) => (
          <button
            key={event.id}
            onClick={() => setSelectedId(event.id)}
            className={`flex-none w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all ${
              selectedId === event.id ? "border-primary scale-95" : "border-white/5 opacity-50"
            }`}
          >
            <img src={event.image} alt={event.title} className="object-cover w-full h-full" />
          </button>
        ))}
      </div>
    </div>
  );
}
