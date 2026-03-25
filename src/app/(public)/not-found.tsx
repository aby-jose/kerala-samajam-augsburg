"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventsCTA } from "@/components/layout/events-cta";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 pt-40 pb-24 space-y-12 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-6"
      >
        <div className="space-y-2">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-sm font-bold tracking-[0.2em] text-primary uppercase"
          >
            Error 404
          </motion.p>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-bold tracking-tight"
          >
            Page not found
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground leading-relaxed px-4"
          >
            Sorry, we couldn't find the page you're looking for. Check the URL or return to our homepage.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="pt-4"
        >
          <Button asChild className="rounded-full px-10 h-14 shadow-lg shadow-primary/10">
            <Link href="/" className="flex items-center gap-2 font-bold uppercase tracking-widest text-[10px]">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </Button>
        </motion.div>
      </motion.div>

      {/* Embedded Events CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="max-w-7xl w-full"
      >
        <EventsCTA className="py-0 pb-0!" />
      </motion.div>
    </div>
  );
}
