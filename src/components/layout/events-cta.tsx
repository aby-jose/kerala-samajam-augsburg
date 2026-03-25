"use client";

import React from "react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface EventsCTAProps {
  className?: string;
}

export function EventsCTA({ className }: EventsCTAProps) {
  return (
    <section className={`py-12 bg-background pb-16 ${className}`}>
      <Container className="max-w-7xl">
        <motion.div 
          className="relative rounded-2xl overflow-hidden bg-secondary/30 p-8 md:p-12 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 group border border-border/50"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Subtle Accent Backdrop */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--primary-rgb),0.05),transparent_60%)] opacity-30 group-hover:opacity-50 transition-opacity duration-1000" />
          
          <div className="relative z-10 max-w-xl space-y-4 text-center md:text-left">
             <div className="flex items-center gap-3 justify-center md:justify-start">
                <div className="h-px w-6 bg-primary/40" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Next Event</span>
             </div>
             
             <div className="space-y-2">
                <h2 className="text-xl md:text-3xl font-serif font-medium text-foreground leading-tight tracking-tight">
                   Experience Kerala <span className="text-primary italic">in Augsburg</span>
                </h2>
                <p className="text-muted-foreground leading-relaxed max-w-sm font-light text-base">
                   Join us for upcoming festivals and cultural workshops.
                </p>
             </div>
          </div>

          <div className="relative z-10 shrink-0">
             <Link href="/events">
                <Button className="h-10 px-6 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-[0.2em] text-[9px] shadow-sm hover:-translate-y-px transition-all flex items-center gap-2 active:scale-[0.98]">
                   Explore Events
                   <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                </Button>
             </Link>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
