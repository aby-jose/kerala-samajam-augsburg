import { z } from "zod";

/**
 * Curated icon set for the "Where We Come From" cards. Kept small and named
 * (rather than accepting an arbitrary lucide icon string) so the admin form
 * can offer a plain dropdown and the public renderer never has to guess
 * whether a stored string is actually a valid icon — see lib/about-icons.ts
 * for the name -> component map shared by both.
 */
export const ABOUT_ICONS = [
  "History",
  "Target",
  "Heart",
  "Users",
  "Globe",
  "Star",
  "Handshake",
  "BookOpen",
] as const;

export const aboutCardSchema = z.object({
  icon: z.enum(ABOUT_ICONS),
  title: z.string().min(1, "Title is required").max(80),
  description: z.string().min(1, "Description is required").max(300),
});

export type AboutCard = z.infer<typeof aboutCardSchema>;

export const aboutContentSchema = z.object({
  eyebrow: z.string().min(1, "Required").max(60),
  title: z.string().min(1, "Required").max(160),
  // Word/phrase within `title` rendered in the accent color, e.g. "Kerala".
  // Falls back to plain text if empty or not found in `title`.
  // No `.default()` here — it would make the schema's input and output types
  // diverge, which react-hook-form's resolver rejects (see settings/page.tsx
  // for the same rule). getAboutContent() always merges the defaults in.
  accentWord: z.string().max(60).optional().or(z.literal("")),
  lead: z.string().min(1, "Required").max(500),
  heroImageUrl: z.string().min(1, "Hero image is required"),
  storyEyebrow: z.string().min(1, "Required").max(60),
  storyTitle: z.string().min(1, "Required").max(160),
  storyAccentWord: z.string().max(60).optional().or(z.literal("")),
  cards: z.array(aboutCardSchema).min(1, "At least one card is required").max(6),
});

export type AboutContentT = z.infer<typeof aboutContentSchema>;

// The copy that lived hardcoded in the page before this editor existed —
// used as the fallback until an admin saves their first edit, so nothing
// changes visually on day one.
export const DEFAULT_ABOUT_CONTENT: AboutContentT = {
  eyebrow: "About us",
  title: "About Kerala Samajam Augsburg",
  accentWord: "Kerala",
  lead: "A registered Verein in Bavaria, run entirely by its members. We celebrate the festivals, teach the language to our children, and help people find their feet when they arrive in Augsburg.",
  heroImageUrl: "/images/about/hero.png",
  storyEyebrow: "Our story",
  storyTitle: "Where We Come From",
  storyAccentWord: "Come From",
  cards: [
    {
      icon: "History",
      title: "How We Started",
      description:
        "In 2012, a handful of families cooked one Onam sadhya together. Word spread, more families came, and the sadhya never stopped.",
    },
    {
      icon: "Target",
      title: "What We Do",
      description:
        "Festivals through the year, Malayalam classes for the children, dance and music on stage, and a hand for anyone new to the city.",
    },
    {
      icon: "Heart",
      title: "What We Stand For",
      description:
        "Open to everyone, run by members and paid for by members. Nobody here is a customer — you join, and then you help cook.",
    },
  ],
};
