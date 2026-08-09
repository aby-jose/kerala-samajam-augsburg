"use client";

import React from "react";
import { Container } from "@/components/layout/container";
import { motion, Variants } from "framer-motion";
import { 
  History, 
  Target, 
  Heart
} from "lucide-react";
import { EventsCTA } from "@/components/layout/events-cta";
import {
  Accent,
  Eyebrow,
  PageHeader,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";

import { getLeadershipMembers } from "@/lib/leadership-actions";
import { Loader2 } from "lucide-react";

export default function AboutPage() {
  const [team, setTeam] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTeam = async () => {
      try {
        const data = await getLeadershipMembers();
        setTeam(data);
      } catch (error) {
        console.error("Failed to load team members:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTeam();
  }, []);

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

      {/* 3. Committee — surface 3 */}
      <section className="py-24 md:py-32 bg-surface-3 border-b border-border">
        <Container className="max-w-7xl">
          <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-xl">
               <Eyebrow>Committee</Eyebrow>
               <SectionTitle className="mt-6">
                  Our <Accent>Committee</Accent>
               </SectionTitle>
            </div>
            <SectionLead className="max-w-sm md:text-right">
               The volunteers who run KSA this year. Every one of them has a day
               job and answers messages anyway.
            </SectionLead>
          </div>

          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 w-full col-span-full">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mt-4">Loading...</p>
            </div>
          ) : team.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-dashed border-border py-20 text-center">
               <p className="font-sans text-lg font-bold tracking-[-0.015em] text-foreground">Committee Not Listed Yet</p>
               <p className="mt-2 text-sm text-muted-foreground">This year&apos;s committee will be published here shortly.</p>
            </div>
          ) : (
            team.map((member, idx) => (
              <motion.div
                key={member.id}
                variants={revealVariants}
                className="group space-y-6"
              >
                <div className="relative aspect-4/5 rounded-3xl overflow-hidden border border-border/10 shadow-sm transition-all duration-700 group-hover:shadow-2xl group-hover:-translate-y-2">
                  {member.image ? (
                    <img 
                      src={member.image} 
                      alt={member.name} 
                      className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105" 
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center text-muted-foreground/20">
                      <Heart className="w-12 h-12" />
                    </div>
                  )}
                </div>

                <div className="space-y-2 px-1 text-center sm:text-left">
                  <h4 className="font-sans text-lg font-bold tracking-[-0.015em] text-foreground transition-colors duration-300 group-hover:text-primary">{member.name}</h4>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{member.role}</span>
                  <div className="h-0.5 w-4 bg-primary/30 group-hover:w-16 transition-all duration-700 rounded-full" />
                </div>
              </motion.div>
            ))
          )}
          </motion.div>
        </Container>
      </section>

      {/* 4. Upcoming Action Banner (7xl Component) */}
      <EventsCTA />
    </main>
  );
}
