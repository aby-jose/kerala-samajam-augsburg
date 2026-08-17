"use client";

import type { ComponentType } from "react";
import { Container } from "@/components/layout/container";
import { motion, Variants } from "framer-motion";
import { EventsBand } from "@/components/layout/events-band";
import { LeadershipRow } from "@/components/layout/leadership-row";
import {
  Eyebrow,
  PageHeader,
  SectionTitle,
} from "@/components/layout/section-heading";
import { withAccent } from "@/components/layout/with-accent";
import { ABOUT_ICON_MAP } from "@/lib/about-icons";
import { resolveSections } from "@/lib/page-layout";
import { ABOUT_SECTION_META } from "@/lib/about-sections";
import { DEFAULT_ABOUT_CONTENT, type AboutContentT, type AboutSectionId } from "@/lib/about-schema";
import { cn } from "@/lib/utils";

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

type SectionSurfaceProps = {
  surface?: string;
  tone?: "surface" | "dark";
  bordered?: boolean;
};

/**
 * 1. Page header — pinned to the top (see ABOUT_SECTION_META), so its
 * surface is always whatever position 0 in the rotation resolves to
 * (bg-surface-1 today, same as before this section had a `surface` prop).
 */
function AboutHeroSection({
  content = DEFAULT_ABOUT_CONTENT.content.hero,
  surface = "bg-surface-1",
}: { content?: AboutContentT["content"]["hero"] } & SectionSurfaceProps) {
  return (
    <section className={cn("pt-40 pb-20 overflow-hidden", surface)}>
      <Container className="max-w-7xl">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={revealVariants}
          className="space-y-12"
        >
          <PageHeader
            eyebrow={content.eyebrow}
            title={withAccent(content.title, content.accentWord)}
            lead={content.lead}
          />

          {/* Large Centered Hero Piece */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative aspect-21/9 md:aspect-2.5/1 w-full rounded-4xl overflow-hidden shadow-3xl border border-border/10 group"
          >
            <img
              src={content.heroImageUrl}
              alt="Kerala Culture in Augsburg"
              className="w-full h-full object-cover transition-transform duration-2000 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent" />
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}

/** 2. What we are — the story heading and the cards. */
function AboutStorySection({
  content = DEFAULT_ABOUT_CONTENT.content.story,
  surface = "bg-surface-2",
  bordered = true,
}: { content?: AboutContentT["content"]["story"] } & SectionSurfaceProps) {
  return (
    <section
      className={cn("py-24 md:py-32", surface, bordered && "border-y border-border")}
    >
      <Container className="max-w-7xl">
        <motion.div
          className="mb-14 max-w-2xl"
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <Eyebrow>{content.eyebrow}</Eyebrow>
          <SectionTitle className="mt-6">
            {withAccent(content.title, content.accentWord)}
          </SectionTitle>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {content.cards.map((item, idx) => {
            const Icon = ABOUT_ICON_MAP[item.icon];
            return (
              <motion.div
                key={idx}
                variants={revealVariants}
                className="group bg-surface-2 p-7 transition-colors duration-300 hover:bg-muted/40 md:p-9"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-1 text-primary transition-colors duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <h3 className="mt-6 font-sans text-lg font-bold tracking-[-0.02em] text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </Container>
    </section>
  );
}

/**
 * 3. Committee — same component the home page uses, so the two stay in
 * sync; here it lists everyone rather than previewing eight. It has no
 * copy of its own (see aboutCommitteeSectionSchema), so no `content` prop
 * is passed through — LeadershipRow falls back to its own default heading.
 *
 * No `seamless`: that prop only made sense back when this section was
 * hardcoded to always sit directly under the always-bordered story
 * section, so its own top border needed dropping to avoid a doubled seam.
 * Now `bordered` is derived from position, and resolveSections's
 * alternation guarantees two bordered (tinted) rotating sections are never
 * adjacent — so there is nothing left to double up, and a plain border-y
 * behaves exactly like every other tinted section (AboutStorySection
 * included), whatever ends up next to it after a reorder.
 */
function AboutCommitteeSection({ surface = "bg-surface-3", bordered = true }: SectionSurfaceProps) {
  return <LeadershipRow limit={0} showEmptyState surface={surface} bordered={bordered} />;
}

/**
 * 4. What's on next — deep band. EventsBand has no configurable content
 * (its copy is hardcoded) and is always the dark closing surface, so it
 * ignores the resolved surface/tone/bordered — they would be
 * bg-surface-deep/dark/false anyway for a "deep" surfaceMode section.
 */
function AboutClosingSection(_props: SectionSurfaceProps) {
  return <EventsBand />;
}

const ABOUT_SECTION_COMPONENTS: Record<AboutSectionId, ComponentType<any>> = {
  hero: AboutHeroSection,
  story: AboutStorySection,
  committee: AboutCommitteeSection,
  closing: AboutClosingSection,
};

export function AboutPageClient({ content }: { content: AboutContentT }) {
  const sections = resolveSections(ABOUT_SECTION_META, content.layout);

  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/5">
      {sections.map(({ id, surface, tone, bordered }) => {
        const Section = ABOUT_SECTION_COMPONENTS[id as AboutSectionId];

        return (
          <Section
            key={id}
            content={content.content[id as AboutSectionId]}
            surface={surface}
            tone={tone}
            bordered={bordered}
          />
        );
      })}
    </main>
  );
}
