"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import {
  Eyebrow,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import { withAccent } from "@/components/layout/with-accent";
import { DEFAULT_HOME_CONTENT, type HomeContentT } from "@/lib/home-schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export function JoinSteps({
  content = DEFAULT_HOME_CONTENT.content.join,
  surface = "bg-surface-1",
  bordered = false,
}: {
  content?: HomeContentT["content"]["join"];
  surface?: string;
  bordered?: boolean;
} = {}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden py-24 md:py-32",
        surface,
        bordered && "border-y border-border"
      )}
    >
      <Container>
        <motion.div
          className="mb-14 flex flex-col justify-between gap-8 md:flex-row md:items-end"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="max-w-2xl">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <SectionTitle className="mt-6">
              {withAccent(content.title, content.accentWord)}
            </SectionTitle>
            <SectionLead className="mt-5 max-w-lg">
              {content.lead}
            </SectionLead>
          </div>

          <Link href={content.cta.href} className="shrink-0">
            <Button
              variant="outline"
              className="h-12 rounded-full border-border px-8 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              {content.cta.label}
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </Link>
        </motion.div>

        {/* Steps */}
        <motion.ol
          className={cn(
            "grid gap-px overflow-hidden rounded-3xl border border-border bg-border",
            content.steps.length === 1
              ? "md:grid-cols-1"
              : content.steps.length === 2
                ? "md:grid-cols-2"
                : "md:grid-cols-3"
          )}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {content.steps.map((step, i) => (
            <motion.li
              key={step.title}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.6, ease: EASE },
                },
              }}
              className="group relative bg-surface-1 p-7 transition-colors duration-300 hover:bg-muted/50 md:p-9"
            >
              <span className="font-sans text-4xl font-extrabold leading-none tracking-[-0.05em] text-primary/25 transition-colors duration-300 group-hover:text-primary/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-6 font-sans text-lg font-bold tracking-[-0.02em] text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.desc}
              </p>
            </motion.li>
          ))}
        </motion.ol>
      </Container>
    </section>
  );
}
