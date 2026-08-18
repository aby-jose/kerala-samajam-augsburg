"use client";

import { motion, Variants } from "framer-motion";
import { Container } from "@/components/layout/container";
import {
  Eyebrow,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import { withAccent } from "@/components/layout/with-accent";
import { useConfig } from "@/components/providers/config-provider";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function WhatsAppCta({
  surface = "bg-surface-deep",
  tone = "dark",
  bordered = false,
  content,
}: {
  surface?: string;
  tone?: "surface" | "dark";
  bordered?: boolean;
  content?: {
    eyebrow?: string;
    title?: string;
    accentWord?: string;
    lead?: string;
  };
}) {
  const config = useConfig();
  const groupLink = config.socials?.whatsapp;

  if (!groupLink) return null;

  const eyebrowText = content?.eyebrow || "Community Chat";
  const titleText = content?.title || "Join our WhatsApp Group";
  const accentWordText = content?.accentWord ?? "Group";
  const leadText = content?.lead || "Get every invitation, every class and every celebration directly in your chat. Stay updated and connected.";

  const revealVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 50, damping: 20, duration: 0.8 }
    },
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden py-28 md:py-36",
        surface,
        bordered && "border-y border-border"
      )}
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
        }}
      />

      <Container className="relative">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={revealVariants}
        >
          <div className="flex justify-center">
            <Eyebrow tone={tone}>{eyebrowText}</Eyebrow>
          </div>

          <SectionTitle tone={tone} className="mt-7 md:text-5xl">
            {withAccent(titleText, accentWordText)}
          </SectionTitle>

          <SectionLead tone={tone} className="mx-auto mt-6 max-w-xl">
            {leadText}
          </SectionLead>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={groupLink} target="_blank" rel="noopener noreferrer" className="group w-full sm:w-auto">
              <Button className="h-12 w-full rounded-full bg-primary hover:bg-primary/95 text-primary-foreground px-9 text-[14px] font-bold shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 sm:w-auto">
                <MessageCircle className="mr-2 h-4 w-4" />
                Join Group
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
              </Button>
            </a>
            <Link href="/contact" className="w-full sm:w-auto">
              <Button
                variant="ghost"
                className="h-12 w-full rounded-full border border-white/15 bg-white/[0.06] px-9 text-[14px] font-semibold text-white backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/15 hover:text-white sm:w-auto"
              >
                Ask a Question First
              </Button>
            </Link>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
