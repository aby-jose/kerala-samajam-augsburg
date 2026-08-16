"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import Link from "next/link";
import {
  ArrowUpRight,
  Flower2,
  GraduationCap,
  HeartHandshake,
  Languages,
  Music,
  Users,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import {
  Accent,
  Eyebrow,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The six things KSA actually does. Laid out as an index — a hairline rule
 * over each entry rather than a boxed cell — so this block does not read as
 * yet another card grid next to JoinSteps further down the page.
 */
const pillars = [
  {
    title: "Festivals and Celebrations",
    icon: Flower2,
    desc: "Onam, Vishu, Christmas and Deepavali — cooked and run by members, every year.",
  },
  {
    title: "Help Settling In",
    icon: HeartHandshake,
    desc: "Anmeldung, flats, schools, insurance. Ask, and someone who has done it will help.",
  },
  {
    title: "Malayalam Classes",
    icon: Languages,
    desc: "Weekend lessons so children born here keep speaking the language at home.",
  },
  {
    title: "Music, Dance and Theatre",
    icon: Music,
    desc: "Classical dance, chenda and stage productions. No audition needed.",
  },
  {
    title: "Study and Work Guidance",
    icon: GraduationCap,
    desc: "Ausbildung, applications and interviews, from members who have been through it.",
  },
  {
    title: "Part of the City",
    icon: Users,
    desc: "Augsburg's cultural calendar and charity drives, open to everyone.",
  },
];

/**
 * Facts we can state without qualification. Not all of them are numbers, so
 * they sit in a hairline-divided spec row rather than a stat block — a stat
 * block promises figures and "e.V." is not one.
 */
const facts = [
  { value: "2012", label: "Founded" },
  { value: "e.V.", label: "Registered Verein" },
  { value: "Augsburg", label: "And the towns around" },
];

export function AboutIntro({
  surface = "bg-surface-1",
  bordered = false,
}: {
  surface?: string;
  bordered?: boolean;
} = {}) {
  const reduced = useReducedMotion();

  const rise: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: EASE },
    },
  };

  const stagger: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07 } },
  };

  return (
    <section
      id="vision"
      className={cn(
        "relative scroll-mt-20 overflow-hidden py-24 md:py-32",
        surface,
        bordered && "border-y border-border"
      )}
    >
      {/* Ambient warmth. Both tints are primary at single-digit alpha, so they
          read as a glow on white and as a faint ember on black. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-0 h-[520px] w-[520px] rounded-full bg-primary/[0.07] blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-primary/[0.05] blur-[100px]"
      />

      <Container className="relative">
        {/* ---------------- The story ---------------- */}
        <div className="grid grid-cols-1 items-center gap-x-16 gap-y-14 lg:grid-cols-12">
          <motion.div
            className="lg:col-span-5"
            variants={rise}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <Eyebrow>About us</Eyebrow>

            <SectionTitle className="mt-6">
              About <Accent>Kerala</Accent> Samajam Augsburg
            </SectionTitle>

            <SectionLead className="mt-6 max-w-lg">
              It started in 2012, when a handful of families cooked one Onam
              sadhya together. Today KSA is a registered Verein with members
              across Augsburg and the towns around it.
            </SectionLead>

            {/* Spec row — hairline dividers, no boxes */}
            <dl className="mt-10 grid max-w-lg grid-cols-3 border-y border-border">
              {facts.map((fact, i) => (
                <div
                  key={fact.label}
                  className={
                    i === 0
                      ? "py-5 pr-5"
                      : "border-l border-border py-5 pl-5 pr-5 last:pr-0"
                  }
                >
                  <dt className="font-sans text-lg font-extrabold leading-none tracking-[-0.03em] text-foreground sm:text-xl">
                    {fact.value}
                  </dt>
                  <dd className="mt-2 text-[11px] leading-snug text-muted-foreground">
                    {fact.label}
                  </dd>
                </div>
              ))}
            </dl>

            <Link
              href="/about"
              className="group mt-10 inline-flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <span className="border-b border-foreground/30 pb-0.5 transition-colors group-hover:border-primary group-hover:text-primary">
                Read our full story
              </span>
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
            </Link>
          </motion.div>

          {/* ---------------- Collage ----------------
              Two frames and a type card on one grid: the tall frame spans both
              rows, so the block always ends flush no matter how the copy wraps. */}
          <motion.div
            className="lg:col-span-7"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <motion.figure
                variants={rise}
                className="group relative aspect-4/3 overflow-hidden rounded-[1.5rem] border border-border bg-muted sm:row-span-2 sm:aspect-auto"
              >
                <img
                  src="/images/gallery/kerala_sadya.png"
                  alt="An Onam sadhya served on a banana leaf"
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent"
                />
                <figcaption className="absolute inset-x-0 bottom-0 p-5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
                    The sadhya it started with
                  </span>
                </figcaption>
              </motion.figure>

              <motion.figure
                variants={rise}
                className="group relative hidden aspect-square overflow-hidden rounded-[1.5rem] border border-border bg-muted sm:block"
              >
                <img
                  src="/images/about/hero.png"
                  alt="A lit nilavilakku, the traditional Kerala lamp"
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
                />
              </motion.figure>

              {/* The rest of the opening line, given room to breathe */}
              <motion.div
                variants={rise}
                className="flex flex-col justify-center rounded-[1.5rem] border border-border bg-surface-2 p-6 md:p-7"
              >
                <span className="h-px w-10 bg-primary" />
                <p className="mt-5 font-serif text-lg italic leading-snug tracking-[-0.01em] text-foreground md:text-xl">
                  Still cooking, still teaching the language, and still
                  answering the phone when someone new needs a hand.
                </p>
                <span className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Since 2012
                </span>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* ---------------- What we do ---------------- */}
        <div className="mt-24 md:mt-32">
          <motion.div
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            variants={rise}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <Eyebrow>What we do</Eyebrow>
            <p className="text-sm text-muted-foreground">
              Run by members, all year round.
            </p>
          </motion.div>

          <motion.div
            className="mt-10 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            {pillars.map((item, i) => (
              <motion.div
                key={item.title}
                variants={rise}
                className="group relative border-t border-border pb-9 pt-7"
              >
                {/* The rule redraws in primary on hover */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-x-100"
                />

                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/10 bg-primary/[0.08] text-primary transition-colors duration-300 group-hover:border-primary/25 group-hover:bg-primary/[0.16]">
                    <item.icon strokeWidth={1.6} className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/50">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <h3 className="mt-5 font-sans text-[17px] font-bold leading-snug tracking-[-0.015em] text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
