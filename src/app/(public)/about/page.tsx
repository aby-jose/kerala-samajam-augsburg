"use client";

import { Container } from "@/components/layout/container";
import { motion, Variants } from "framer-motion";
import { 
  History, 
  Target, 
  Heart
} from "lucide-react";
import { EventsBand } from "@/components/layout/events-band";
import { LeadershipRow } from "@/components/layout/leadership-row";
import {
  Accent,
  Eyebrow,
  PageHeader,
  SectionTitle,
} from "@/components/layout/section-heading";

export default function AboutPage() {
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
      <section className="pt-40 pb-20 bg-surface-1 overflow-hidden">
        <Container className="max-w-7xl">
           <motion.div
             initial="hidden"
             animate="visible"
             variants={revealVariants}
             className="space-y-12"
           >
              <PageHeader
                eyebrow="About us"
                title={<>About <Accent>Kerala</Accent> Samajam Augsburg</>}
                lead="A registered Verein in Bavaria, run entirely by its members. We celebrate the festivals, teach the language to our children, and help people find their feet when they arrive in Augsburg."
              />

              {/* Large Centered Hero Piece */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="relative aspect-21/9 md:aspect-2.5/1 w-full rounded-4xl overflow-hidden shadow-3xl border border-border/10 group"
              >
                 <img 
                   src="/images/about/hero.png" 
                   alt="Kerala Culture in Augsburg" 
                   className="w-full h-full object-cover transition-transform duration-2000 group-hover:scale-105" 
                 />
                 <div className="absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent" />
              </motion.div>
           </motion.div>
        </Container>
      </section>

      {/* 2. What we are — surface 2 */}
      <section className="py-24 md:py-32 bg-surface-2 border-y border-border">
        <Container className="max-w-7xl">
          <motion.div
            className="mb-14 max-w-2xl"
            variants={revealVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <Eyebrow>Our story</Eyebrow>
            <SectionTitle className="mt-6">
              Where We <Accent>Come From</Accent>
            </SectionTitle>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                icon: History,
                title: "How We Started",
                desc: "In 2012, a handful of families cooked one Onam sadhya together. Word spread, more families came, and the sadhya never stopped."
              },
              {
                icon: Target,
                title: "What We Do",
                desc: "Festivals through the year, Malayalam classes for the children, dance and music on stage, and a hand for anyone new to the city."
              },
              {
                icon: Heart,
                title: "What We Stand For",
                desc: "Open to everyone, run by members and paid for by members. Nobody here is a customer — you join, and then you help cook."
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                variants={revealVariants}
                className="group bg-surface-2 p-7 transition-colors duration-300 hover:bg-muted/40 md:p-9"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-1 text-primary transition-colors duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <item.icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <h3 className="mt-6 font-sans text-lg font-bold tracking-[-0.02em] text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* 3. Committee — surface 3. Same component the home page uses, so the two
          stay in sync; here it lists everyone rather than previewing eight. */}
      <LeadershipRow limit={0} showEmptyState seamless />

      {/* 4. What's on next — deep band */}
      <EventsBand />
    </main>
  );
}
