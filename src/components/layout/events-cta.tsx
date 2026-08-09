"use client";

import React from "react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Accent, Eyebrow } from "@/components/layout/section-heading";

interface EventsCTAProps {
  className?: string;
}

export function EventsCTA({ className }: EventsCTAProps) {
  return (
    <section className={`py-16 bg-surface-1 pb-20 ${className}`}>
      <Container className="max-w-7xl">
        <motion.div
          className="relative rounded-3xl overflow-hidden bg-surface-2 p-8 md:p-12 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 group border border-border"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Subtle Accent Backdrop */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--primary-rgb),0.05),transparent_60%)] opacity-30 group-hover:opacity-50 transition-opacity duration-1000" />
          
          <div className="relative z-10 max-w-xl space-y-4 text-center md:text-left">
             <div className="flex justify-center md:justify-start">
                <Eyebrow>Events</Eyebrow>
             </div>

             <div className="space-y-2">
                <h2 className="font-sans text-xl md:text-3xl font-extrabold leading-tight tracking-[-0.035em] text-foreground">
                   See What&apos;s <Accent>Coming Up</Accent>
                </h2>
                <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                   Festivals, workshops and gatherings on the calendar right now.
                </p>
             </div>
          </div>

          <div className="relative z-10 shrink-0">
             <Link href="/events">
                <Button className="h-11 px-8 rounded-full bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-[0.2em] text-[10px] shadow-sm hover:-translate-y-px transition-all flex items-center gap-2 active:scale-[0.98]">
                   View Events
                   <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                </Button>
             </Link>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
