import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface EventCardProps {
  event: {
    id: string;
    title: string;
    date: string;
    location: string;
    description: string;
    image: string;
    category?: string;
  };
}

export function EventCard({ event }: EventCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="group"
    >
      <Link href={`/events/${event.id}`} className="block space-y-6">
        {/* Immersive Video Aspect Image - Premium Frame */}
        <div className="relative aspect-video rounded-3xl overflow-hidden border border-border/10 shadow-sm transition-all duration-700 group-hover:shadow-2xl group-hover:-translate-y-1.5 bg-muted">
          <img 
            src={event.image} 
            alt={event.title} 
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
          />
          
          {/* Subtle Metadata Overlays */}
          <div className="absolute top-4 left-4">
             <Badge className="bg-background/80 text-foreground backdrop-blur-md border border-border/50 px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-[0.2em] shadow-sm">
                {event.category || "General"}
             </Badge>
          </div>
          
          <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[9px] font-bold shadow-sm border border-border/50 text-foreground uppercase tracking-[0.2em]">
            {new Date(event.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* Info Area (Museum-Grade Editorial) */}
        <div className="space-y-4 px-1">
           {/* Refined Metadata Row - Low-Intensity */}
           <div className="flex items-center gap-5 text-muted-foreground">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]">
                 <Calendar className="w-3.5 h-3.5 text-primary/80" />
                 {formatDate(event.date)}
              </div>
              <div className="h-4 w-px bg-border/60" />
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]">
                 <MapPin className="w-3.5 h-3.5 text-primary/80" />
                 {event.location}
              </div>
           </div>

           {/* Title Area - Zero Primary Color Shift */}
           <div className="space-y-3">
              <h3 className="text-xl md:text-2xl font-serif font-medium text-foreground leading-tight tracking-tight transition-colors duration-300">
                 {event.title}
              </h3>
              <p className="text-sm text-muted-foreground/80 leading-relaxed line-clamp-2 font-light max-w-sm italic">
                 {event.description}
              </p>
           </div>

           {/* Premium Action - Subtle Transition */}
           <div className="pt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground group-hover:text-foreground transition-all duration-300 group-hover:translate-x-1">
              Explore Milestone
              <ArrowRight className="w-4 h-4 text-primary" />
           </div>
        </div>
      </Link>
    </motion.div>
  );
}
