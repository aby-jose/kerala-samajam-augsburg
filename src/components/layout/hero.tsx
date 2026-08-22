"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DEFAULT_HOME_CONTENT, type HomeContentT } from "@/lib/home-schema";
import { splitOnAccent } from "@/lib/accent";

const EASE = [0.16, 1, 0.3, 1] as const;

// Opacity + y only — no `filter: blur()`. Lighthouse flags animated `filter`
// as non-composited (it forces main-thread rasterization every frame); the
// blur was a nice touch but not one worth the jank on slower devices.
const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1.3, ease: EASE, delay },
});

export function Hero({
  content = DEFAULT_HOME_CONTENT.content.hero,
  surface = "bg-black",
}: {
  content?: HomeContentT["content"]["hero"];
  surface?: string;
} = {}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { before, match, after } = splitOnAccent(content.headline, content.accentWord);

  // Fade + drift the whole composition as the next section takes over.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  return (
    <section
      ref={ref}
      className={cn(
        "relative isolate w-full h-svh min-h-[640px] overflow-hidden",
        surface
      )}
    >
      {/* ---------- Full-bleed video ---------- */}
      <motion.div
        aria-hidden
        style={reduced ? undefined : { y: videoY }}
        className="absolute -inset-px z-0 select-none pointer-events-none"
      >
        <motion.div
          initial={reduced ? false : { scale: 1.14 }}
          animate={{ scale: 1 }}
          transition={{ duration: 6, ease: EASE }}
          className="absolute inset-0"
        >
          <video
            autoPlay={!reduced}
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            poster={content.posterUrl}
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src={content.videoUrl} type="video/mp4" />
          </video>
        </motion.div>
      </motion.div>

      {/* ---------- Legibility scrims ----------
          Bottom-weighted rather than a flat wash, so the footage stays visible
          in the upper two thirds while the type sits on solid darkness. */}
      <div aria-hidden className="absolute inset-0 z-10 pointer-events-none">
        {/* vertical: dark under the navbar, settling to black at the base */}
        <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/30 to-black/90" />
        {/* centred wash so the type sits on even darkness */}
        <div className="absolute inset-0 bg-black/25" />
        {/* vignette, centred on the composition */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 65% at 50% 50%, transparent 0%, rgba(0,0,0,0.6) 100%)",
          }}
        />
        {/* film grain */}
        <div
          className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        {/* settle to pure black at the base so the next section joins seamlessly */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-black to-transparent" />
      </div>

      {/* ---------- Content ---------- */}
      <motion.div
        style={reduced ? undefined : { y: contentY, opacity: contentOpacity }}
        className="relative z-20 flex h-full flex-col items-center justify-center pt-24 pb-16"
      >
        <Container className="flex flex-col items-center text-center">
          {/* Eyebrow */}
          <motion.div
            {...fade(0.25)}
            className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 backdrop-blur-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">
              {content.badge}
            </span>
          </motion.div>

          {/* Headline — deliberately NOT a motion element. This is the
              page's LCP candidate, and an entrance animation means the
              browser can't count it as painted until hydration runs and
              the animation clears the fade, which measured as a 3.2s render
              delay on a throttled mobile connection. Everything around it
              still gets the cascading reveal; this anchors the composition
              instead of joining it. */}
          <h1 className="mt-7 max-w-4xl text-balance font-sans text-[2.25rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-white sm:text-5xl md:text-6xl">
            {before}
            {match && (
              <span className="bg-linear-to-br from-primary to-primary/70 bg-clip-text font-serif font-normal italic tracking-[-0.015em] text-transparent">
                {match}
              </span>
            )}
            {after}
          </h1>

          {/* Sub-copy */}
          <motion.p
            {...fade(0.55)}
            className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/60 md:text-base"
          >
            {content.lead}
          </motion.p>

          {/* Actions */}
          <motion.div
            {...fade(0.7)}
            className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center"
          >
            <Link href={content.primaryCta.href} className="group">
              <Button className="h-12 w-full rounded-full px-8 text-[14px] font-bold shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-primary/35 sm:w-auto">
                {content.primaryCta.label}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
              </Button>
            </Link>

            <Link href={content.secondaryCta.href} className="group">
              <Button
                variant="ghost"
                className="h-12 w-full rounded-full border border-white/20 bg-white/[0.06] px-8 text-[14px] font-semibold text-white backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/15 hover:text-white sm:w-auto"
              >
                {content.secondaryCta.label}
              </Button>
            </Link>
          </motion.div>
        </Container>
      </motion.div>
    </section>
  );
}
