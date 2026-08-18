import type { ComponentType } from "react";
import type { HomeSectionId } from "@/lib/home-schema";
import { Hero } from "@/components/layout/hero";
import { AboutIntro } from "@/components/layout/about-intro";
import { EventsBandSection } from "@/components/layout/events-band-section";
import { GalleryStrip } from "@/components/layout/gallery-strip";
import { ReelsSection } from "@/components/layout/reels-section";
import { LeadershipRow } from "@/components/layout/leadership-row";
import { JoinSteps } from "@/components/layout/join-steps";
import { JoinCta } from "@/components/layout/join-cta";

/** Which component renders each section id. The admin labels and surface
 *  modes live in lib/home-sections.ts, which stays free of imports like
 *  these so the tests can read it. */
export const HOME_SECTION_COMPONENTS: Record<HomeSectionId, ComponentType<any>> = {
  hero: Hero,
  about: AboutIntro,
  events: EventsBandSection,
  gallery: GalleryStrip,
  reels: ReelsSection,
  committee: LeadershipRow,
  join: JoinSteps,
  cta: JoinCta,
};
