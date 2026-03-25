"use client";

import { motion, Variants } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import Link from "next/link";

export function Hero() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20
      }
    },
  };

  return (
    <section className="relative w-full h-svh min-h-[600px] flex items-center overflow-hidden bg-black">
      {/* 
          Aggressive Full-Bleed Video Background 
          Uniform cinematic zoom scale (1.3x) across all devices and breakpoints
      */}
      <div className="absolute -inset-[2px] z-0 overflow-hidden select-none pointer-events-none">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover scale-[1.3]"
          poster="https://images.pexels.com/photos/2349168/pexels-photo-2349168.jpeg?auto=compress&cs=tinysrgb&w=1920"
        >
          <source
            src="/videoplayback.mp4"
            type="video/mp4"
          />
        </video>
        {/* Subtle cinematic gradient overlay for readability and depth */}
        <div className="absolute inset-0 bg-black/45" />
      </div>

      <Container className="relative z-10 pt-20">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center">
          <motion.div
            className="w-full max-w-2xl text-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="flex justify-center mb-6">
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-bold bg-primary text-white tracking-[0.2em] uppercase shadow-lg shadow-primary/20">
                <Compass className="h-3 w-3 mr-2" />
                Kerala Samajam Augsburg • Est. 2012
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-serif font-medium tracking-tight leading-[1.1] text-white mb-6 text-balance"
            >
              Where Tradition <span className="text-primary italic">Meets</span> the Horizon.
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-lg md:text-xl text-white/90 mb-10 mx-auto max-w-2xl leading-relaxed font-light"
            >
              A vibrant home for our community in Augsburg. We preserve our cultural identity while building a shared, meaningful future together.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/contact" className="w-full sm:w-auto">
                <Button size="lg" className="h-14 px-10 text-base font-bold rounded-full shadow-xl w-full sm:w-auto hover:translate-y-[-2px] transition-all bg-primary hover:bg-primary/90">
                  Join Community
                </Button>
              </Link>
              <Link href="/events" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="h-14 px-10 text-base font-bold rounded-full w-full sm:w-auto border-white/20 bg-white/5 text-white backdrop-blur-md hover:bg-white/15 transition-all">
                  Explore Events
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </Container>

      {/* Scroll indicator - Hidden on very small height screens */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-10 right-10 z-10 hidden sm:flex items-center gap-4 text-white/40"
      >
        <span className="text-[10px] uppercase tracking-[0.4em] font-medium">Scroll to explore</span>
        <div className="w-12 h-px bg-white/20 relative overflow-hidden">
          <motion.div
            animate={{ x: [-48, 48] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="absolute top-0 left-0 h-full w-1/2 bg-primary/60"
          />
        </div>
      </motion.div>
    </section>
  );
}
