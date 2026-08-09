import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Section typography, matched to the hero.
 *
 * The hero sets the voice: a pill eyebrow at 10px/0.22em, a Manrope
 * extrabold headline at -0.035em tracking, and a single Newsreader italic
 * word in primary as the accent. Everything below the fold reuses those
 * three pieces so the page reads as one type system.
 *
 * `tone="dark"` is for sections sitting on surface-deep or imagery.
 */

type Tone = "surface" | "dark";

export function Eyebrow({
  children,
  className,
  tone = "surface",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5",
        tone === "dark"
          ? "border-white/15 bg-white/[0.06] backdrop-blur-md"
          : "border-border bg-surface-1/60 backdrop-blur-sm",
        className
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.22em]",
          tone === "dark" ? "text-white/70" : "text-muted-foreground"
        )}
      >
        {children}
      </span>
    </span>
  );
}

export function SectionTitle({
  children,
  className,
  tone = "surface",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <h2
      className={cn(
        "font-sans text-[2rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-balance sm:text-4xl md:text-[2.75rem]",
        tone === "dark" ? "text-white" : "text-foreground",
        className
      )}
    >
      {children}
    </h2>
  );
}

/** The one italic serif word per headline — same treatment as "Kerala" in the hero. */
export function Accent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-serif font-normal italic tracking-[-0.015em] text-primary",
        className
      )}
    >
      {children}
    </span>
  );
}

/** The h1 for interior pages — one size up from SectionTitle, same voice. */
export function PageTitle({
  children,
  className,
  tone = "surface",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <h1
      className={cn(
        "font-sans text-[2.5rem] font-extrabold leading-[1.06] tracking-[-0.04em] text-balance sm:text-5xl md:text-6xl",
        tone === "dark" ? "text-white" : "text-foreground",
        className
      )}
    >
      {children}
    </h1>
  );
}

/**
 * Standard opening block for every interior page: pill eyebrow, headline,
 * one line of lead copy. Pages sit under a transparent navbar, so the top
 * padding lives here rather than being re-guessed per page.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-3xl text-center", className)}>
      <div className="flex justify-center">
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
      <PageTitle className="mt-7">{title}</PageTitle>
      {lead && (
        <SectionLead className="mx-auto mt-6 max-w-xl">{lead}</SectionLead>
      )}
      {children}
    </div>
  );
}

export function SectionLead({
  children,
  className,
  tone = "surface",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <p
      className={cn(
        "text-[15px] leading-relaxed md:text-base",
        tone === "dark" ? "text-white/60" : "text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}
