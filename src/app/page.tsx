"use client";

import { motion, Variants } from "framer-motion";
import { Hero } from "@/components/layout/hero";
import { Countdown } from "@/components/layout/countdown";
import { EventsShowcase } from "@/components/layout/events-showcase";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin,
  Calendar,
  ArrowRight,
  HeartHandshake,
  Globe,
  Lightbulb,
  Users,
  ChevronRight,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

// Mock upcoming events for the home page teaser
const upcomingEvents = [
  {
    id: "1",
    title: "Grand Onam Celebration 2026",
    date: "2026-08-30T10:00:00",
    location: "Augsburg Community Hall",
    description: "Experience the vibrant spirit of Kerala with traditional Pookalam, grand Onasadhya, and cultural performances that bring our heritage to life in the heart of Augsburg.",
    image: "/images/events/onam-celebration.png",
  },
  {
    id: "2",
    title: "Kerala Traditional Music Night",
    date: "2026-05-15T18:00:00",
    location: "Kulturhaus Abraxas",
    description: "An evening of soul-stirring rhythms featuring traditional instruments like Chenda and Mridangam, blending classical Kerala music with modern artistic expressions.",
    image: "/images/events/music-night.png",
  },
  {
    id: "3",
    title: "Traditional Arts Workshop",
    date: "2026-06-20T14:00:00",
    location: "KSA Cultural Center",
    description: "A hands-on workshop dedicated to preserving Kerala's unique arts. Learn the intricate techniques of Kathakali mask making and traditional mural painting from experts.",
    image: "/images/events/traditional-workshop.png",
  },
  {
    id: "4",
    title: "Summer Community Gathering",
    date: "2026-07-12T11:00:00",
    location: "Augsburg City Park",
    description: "Join your KSA family for a day of fun, food, and friendship. A perfect opportunity for the community to connect and celebrate together.",
    image: "/images/events/summer.jpg",
  },
];

export default function Home() {
  const revealVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 50, damping: 20, duration: 0.8 }
    },
  };

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Hero />

      {/* Our Vision Section - Redesigned */}
      <section className="pt-20 pb-12 md:pt-32 md:pb-16 relative overflow-hidden bg-background">
        <Container>
          <motion.div
            className="text-center max-w-3xl mx-auto mb-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={revealVariants}
          >
            <span className="text-primary font-bold uppercase tracking-[0.2em] text-[10px] mb-4 block">Our North Star</span>
            <h2 className="text-4xl md:text-6xl font-serif font-medium mb-6 leading-[1.1]">
              Bridging Heritage with <span className="text-primary italic">Modernity</span>.
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Kerala Samajam Augsburg (KSA) is a sanctuary for our culture, striving to maintain our vibrant identity while fostering meaningful integration.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {[
              { title: "Cultural Preservation", icon: Globe, desc: "Keeping our traditions alive for the next generation." },
              { title: "Community Integration", icon: HeartHandshake, desc: "Building bridges with the local Augsburg community." },
              { title: "Youth Mentorship", icon: Lightbulb, desc: "Empowering our youth to lead with vision." },
              { title: "Social Connectivity", icon: Users, desc: "Creating a home away from home for every Malayali." }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                className="p-6 md:p-8 rounded-3xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-all group"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { delay: idx * 0.1, duration: 0.5 }
                  }
                }}
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h4 className="text-xl font-bold mb-3">{item.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="relative rounded-4xl overflow-hidden aspect-4/5 md:aspect-21/9 shadow-2xl"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={revealVariants}
          >
            <img
              src="https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=2000&auto=format&fit=crop"
              alt="Community Gathering"
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent flex items-end p-8 md:p-12">
              <div className="max-w-xl">
                <div className="text-3xl md:text-4xl font-serif text-white mb-2">10+ Years of Legacy</div>
                <div className="text-white/70 text-sm md:text-base">Serving the Malayali community in Augsburg since 2012.</div>
              </div>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* Upcoming Events Section - Redesigned */}
      <section className="pt-8 pb-32 relative overflow-hidden bg-background">
        <Container>
          <motion.div
            className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={revealVariants}
          >
            <div className="max-w-2xl">
              <span className="text-primary font-bold uppercase tracking-[0.4em] text-[9px] mb-3 block opacity-50">
                Save The Date
              </span>
              <h2 className="text-4xl md:text-5xl font-serif font-medium leading-[1.2] text-foreground tracking-tight">
                Events <span className="text-primary italic">&</span> Gatherings
              </h2>
            </div>
            <Link href="/events" className="pb-1">
              <Button variant="outline" className="text-[9px] font-bold uppercase tracking-[0.2em] rounded-full px-8 h-12 border-primary/20 hover:bg-primary hover:text-white transition-all">
                Full Calendar
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </Link>
          </motion.div>

          <EventsShowcase events={upcomingEvents} />
        </Container>
      </section>

      {/* Call to Action */}
      <section className="py-32 relative overflow-hidden bg-black text-center border-t border-border/50">
        <Container>
          <motion.div
            className="max-w-3xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={revealVariants}
          >
            <h2 className="text-4xl md:text-5xl font-serif font-medium mb-6 text-white leading-tight">
              Become a part of the <span className="text-primary">KSA Family</span>
            </h2>
            <p className="text-lg text-zinc-400 mb-10 mx-auto max-w-xl">
              Together, we preserve our heritage and build a stronger, more connected future in Augsburg.
            </p>
            <Link href="/contact">
              <Button size="lg" className="h-14 px-10 text-base font-semibold shadow-none">
                Join KSA Today
              </Button>
            </Link>
          </motion.div>
        </Container>
      </section>
    </main>
  );
}
