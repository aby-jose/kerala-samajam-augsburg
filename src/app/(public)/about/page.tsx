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

const team = [
  { name: "Aby Joseph", role: "President", image: "/images/team/1.jpg" },
  { name: "John Doe", role: "Secretary", image: "/images/team/2.jpg" },
  { name: "Sarah Smith", role: "Treasurer", image: "/images/team/3.jpg" },
  { name: "Mathews P.", role: "Public Relations", image: "/images/team/4.png" },
];

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
      
      {/* 1. Grand Centered Editorial Hero (7xl) */}
      <section className="pt-40 pb-20 border-b border-border/5 overflow-hidden">
        <Container className="max-w-7xl">
           <motion.div
             initial="hidden"
             animate="visible"
             variants={revealVariants}
             className="text-center space-y-12"
           >
              {/* Centered Typography */}
              <div className="space-y-6 max-w-4xl mx-auto">
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.5em] block">Our Cultural Vision</span>
                <h1 className="text-4xl md:text-6xl font-serif font-medium leading-[1.05] tracking-tight text-foreground">
                  Preserving <span className="text-primary italic">Kerala</span> Culture.<br />
                  Enriching Augsburg.
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-light max-w-2xl mx-auto pt-4">
                   Kerala Samajam Augsburg (KSA) is an institutional non-profit dedicated to fostering cultural exchange and supporting the Malayali community in Germany through professional advocacy.
                </p>
              </div>

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

      {/* 2. Mission Matrix (7xl High-Density) */}
      <section className="py-24 bg-background">
        <Container className="max-w-7xl">
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-16 items-start"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              { 
                icon: History, 
                title: "Our Heritage", 
                desc: "Founded in 2018, KSA started as a small gathering of families wishing to stay connected to their roots and share our rich culture." 
              },
              { 
                icon: Target, 
                title: "Strategic Mission", 
                desc: "To create a high-end platform for cultural preservation, social support, and seamless integration for Keralites in Augsburg." 
              },
              { 
                icon: Heart, 
                title: "Institutional Values", 
                desc: "Integrity, community spirit, and inclusivity are the pillars that guide every initiative and celebration we undertake." 
              },
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                variants={revealVariants}
                className="space-y-6 group"
              >
                <div className="h-12 w-12 rounded-2xl bg-muted/50 border border-border flex items-center justify-center text-primary group-hover:bg-primary/5 group-hover:border-primary/20 transition-all duration-300">
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-serif font-medium text-foreground tracking-tight">{item.title}</h3>
                  <p className="text-muted-foreground/80 leading-relaxed font-light text-base">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* 3. Vibrant 4-Column Governance Roster (7xl Single Row) */}
      <section className="py-24 bg-muted/20 border-y border-border/40">
        <Container className="max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8 text-center md:text-left">
            <div className="space-y-4 max-w-xl mx-auto md:mx-0">
               <span className="text-[10px] font-bold text-primary uppercase tracking-[0.4em] block">Governance Architecture</span>
               <h2 className="text-3xl md:text-5xl font-serif font-medium leading-tight text-foreground tracking-tight">
                  Executive <span className="text-primary italic">Leadership</span>
               </h2>
            </div>
            <p className="text-sm text-muted-foreground/80 max-w-xs border-l border-primary/30 pl-8 md:pl-8 py-1 font-light leading-relaxed">
               Steering our community with vibrant integrity and a dedication to cultural growth.
            </p>
          </div>

          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {team.map((member, idx) => (
              <motion.div
                key={idx}
                variants={revealVariants}
                className="group space-y-6"
              >
                {/* Colorful Portrait Card */}
                <div className="relative aspect-4/5 rounded-3xl overflow-hidden border border-border/10 shadow-sm transition-all duration-700 group-hover:shadow-2xl group-hover:-translate-y-2">
                  <img 
                    src={member.image} 
                    alt={member.name} 
                    className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105" 
                  />
                </div>

                {/* Info Below Image */}
                <div className="space-y-2 px-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] block">{member.role}</span>
                  <h4 className="text-xl font-serif font-medium text-foreground group-hover:text-primary transition-colors duration-300">{member.name}</h4>
                  <div className="h-0.5 w-4 bg-primary/30 group-hover:w-16 transition-all duration-700 rounded-full" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* 4. Upcoming Action Banner (7xl Component) */}
      <EventsCTA />
    </main>
  );
}
