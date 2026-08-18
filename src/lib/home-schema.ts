import { z } from "zod";

/**
 * The home page as one editable document. `layout` owns order and visibility;
 * `content` owns the words and pictures, keyed by section id so a field path
 * never changes when a section moves — see lib/home-layout.ts for the
 * ordering rules and lib/home-sections.ts for what each id renders as.
 */
export const HOME_SECTION_IDS = [
  "hero",
  "about",
  "events",
  "gallery",
  "reels",
  "committee",
  "join",
  "cta",
  "whatsappCta",
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

/** Curated icon set for the "What we do" pillars, same contract as
 *  ABOUT_ICONS: a named tuple so the admin form offers a dropdown and the
 *  renderer never guesses whether a stored string is a real icon. */
export const HOME_ICONS = [
  "Flower2",
  "HeartHandshake",
  "Languages",
  "Music",
  "GraduationCap",
  "Users",
  "Utensils",
  "BookOpen",
] as const;

const linkSchema = z.object({
  label: z.string().min(1, "Label is required").max(60),
  href: z.string().min(1, "Link is required").max(200),
});

/** Eyebrow + title + accent + lead, repeated by every section below. */
const headingFields = {
  eyebrow: z.string().min(1, "Required").max(60),
  title: z.string().min(1, "Required").max(160),
  // Must appear inside `title` verbatim; rendered in the serif italic accent.
  // Plain text when blank or not found — see lib/accent.ts.
  accentWord: z.string().max(60).optional().or(z.literal("")),
  lead: z.string().min(1, "Required").max(500),
};

export const heroSectionSchema = z.object({
  badge: z.string().min(1, "Required").max(60),
  headline: z.string().min(1, "Required").max(160),
  accentWord: z.string().max(60).optional().or(z.literal("")),
  lead: z.string().min(1, "Required").max(500),
  primaryCta: linkSchema,
  secondaryCta: linkSchema,
  videoUrl: z.string().min(1, "A background video is required"),
  posterUrl: z.string().min(1, "A poster image is required"),
});

export const aboutSectionSchema = z.object({
  ...headingFields,
  facts: z
    .array(
      z.object({
        value: z.string().min(1, "Required").max(20),
        label: z.string().min(1, "Required").max(40),
      })
    )
    .min(2, "At least two facts are required")
    .max(4),
  storyLink: linkSchema,
  collage: z.object({
    primary: z.object({
      url: z.string().min(1, "An image is required"),
      alt: z.string().min(1, "Alt text is required").max(160),
      caption: z.string().max(60).optional().or(z.literal("")),
    }),
    secondary: z.object({
      url: z.string().min(1, "An image is required"),
      alt: z.string().min(1, "Alt text is required").max(160),
    }),
  }),
  quote: z.object({
    text: z.string().min(1, "Required").max(300),
    footnote: z.string().max(40).optional().or(z.literal("")),
  }),
  pillarsEyebrow: z.string().min(1, "Required").max(60),
  pillarsNote: z.string().min(1, "Required").max(120),
  pillars: z
    .array(
      z.object({
        icon: z.enum(HOME_ICONS),
        title: z.string().min(1, "Required").max(80),
        desc: z.string().min(1, "Required").max(300),
      })
    )
    .min(1, "At least one is required")
    .max(8),
});

export const eventsSectionSchema = z.object({
  ...headingFields,
  count: z.number().int().min(1).max(8),
  cta: linkSchema,
  empty: z.object({
    title: z.string().min(1, "Required").max(80),
    body: z.string().min(1, "Required").max(200),
  }),
});

export const gallerySectionSchema = z.object({
  ...headingFields,
  link: linkSchema,
});

export const reelsSectionSchema = z.object({
  heading: z.string().min(1, "Required").max(160),
  subheading: z.string().max(300).optional().or(z.literal("")),
  maxCount: z.number().int().min(1).max(20),
});

export const committeeSectionSchema = z.object({
  ...headingFields,
  limit: z.number().int().min(1).max(24),
});

export const joinSectionSchema = z.object({
  ...headingFields,
  cta: linkSchema,
  steps: z
    .array(
      z.object({
        title: z.string().min(1, "Required").max(80),
        desc: z.string().min(1, "Required").max(300),
      })
    )
    .min(1, "At least one step is required")
    .max(6),
});

export const ctaSectionSchema = z.object({
  ...headingFields,
  primaryCta: linkSchema,
  secondaryCta: linkSchema,
});

export const homeContentSchema = z.object({
  layout: z
    .array(
      z.object({
        id: z.enum(HOME_SECTION_IDS),
        visible: z.boolean(),
      })
    )
    .min(1),
  content: z.object({
    hero: heroSectionSchema,
    about: aboutSectionSchema,
    events: eventsSectionSchema,
    gallery: gallerySectionSchema,
    reels: reelsSectionSchema,
    committee: committeeSectionSchema,
    join: joinSectionSchema,
    cta: ctaSectionSchema,
    whatsappCta: z.object({
      eyebrow: z.string().min(1, "Required").max(60),
      title: z.string().min(1, "Required").max(160),
      accentWord: z.string().max(60).optional().or(z.literal("")),
      lead: z.string().min(1, "Required").max(500),
    }),
  }),
});

export type HomeContentT = z.infer<typeof homeContentSchema>;
export type HomeContentSections = HomeContentT["content"];

/**
 * The copy that lived hardcoded across six components before this editor
 * existed — used as the fallback until an admin saves their first edit, so
 * nothing changes visually on day one.
 */
export const DEFAULT_HOME_CONTENT: HomeContentT = {
  layout: [
    { id: "hero", visible: true },
    { id: "about", visible: true },
    { id: "events", visible: true },
    { id: "gallery", visible: true },
    { id: "reels", visible: false },
    { id: "committee", visible: true },
    { id: "join", visible: true },
    { id: "cta", visible: true },
    { id: "whatsappCta", visible: false },
  ],
  content: {
    // from components/layout/hero.tsx
    hero: {
      badge: "Kerala Samajam Augsburg",
      headline: "A home for Kerala in the heart of Augsburg",
      accentWord: "Kerala",
      lead: "The Malayali community in Bavaria — celebrating our culture, supporting each other, and building a home away from home since 2012.",
      primaryCta: { label: "Become a Member", href: "/membership" },
      secondaryCta: { label: "Upcoming Events", href: "/events" },
      videoUrl: "/hero.mp4",
      posterUrl: "/hero-poster.jpg",
    },
    // from components/layout/about-intro.tsx
    about: {
      eyebrow: "About us",
      title: "About Kerala Samajam Augsburg",
      accentWord: "Kerala",
      lead: "It started in 2012, when a handful of families cooked one Onam sadhya together. Today KSA is a registered Verein with members across Augsburg and the towns around it.",
      facts: [
        { value: "2012", label: "Founded" },
        { value: "e.V.", label: "Registered Verein" },
        { value: "Augsburg", label: "And the towns around" },
      ],
      storyLink: { label: "Read our full story", href: "/about" },
      collage: {
        primary: {
          url: "/images/gallery/kerala_sadya.png",
          alt: "An Onam sadhya served on a banana leaf",
          caption: "The sadhya it started with",
        },
        secondary: {
          url: "/images/about/hero.png",
          alt: "A lit nilavilakku, the traditional Kerala lamp",
        },
      },
      quote: {
        text: "Still cooking, still teaching the language, and still answering the phone when someone new needs a hand.",
        footnote: "Since 2012",
      },
      pillarsEyebrow: "What we do",
      pillarsNote: "Run by members, all year round.",
      pillars: [
        {
          icon: "Flower2",
          title: "Festivals and Celebrations",
          desc: "Onam, Vishu, Christmas and Deepavali — cooked and run by members, every year.",
        },
        {
          icon: "HeartHandshake",
          title: "Help Settling In",
          desc: "Anmeldung, flats, schools, insurance. Ask, and someone who has done it will help.",
        },
        {
          icon: "Languages",
          title: "Malayalam Classes",
          desc: "Weekend lessons so children born here keep speaking the language at home.",
        },
        {
          icon: "Music",
          title: "Music, Dance and Theatre",
          desc: "Classical dance, chenda and stage productions. No audition needed.",
        },
        {
          icon: "GraduationCap",
          title: "Study and Work Guidance",
          desc: "Ausbildung, applications and interviews, from members who have been through it.",
        },
        {
          icon: "Users",
          title: "Part of the City",
          desc: "Augsburg's cultural calendar and charity drives, open to everyone.",
        },
      ],
    },
    // from the events band inline in app/(public)/page.tsx
    events: {
      eyebrow: "Events",
      title: "Upcoming Events",
      accentWord: "Events",
      lead: "Everything on the calendar right now. Members hear about new dates first, and everyone is welcome at most of them.",
      count: 4,
      cta: { label: "Full Calendar", href: "/events" },
      empty: {
        title: "Nothing on the calendar just yet",
        body: "New dates are announced here first — members hear about them by email.",
      },
    },
    // from components/layout/gallery-strip.tsx
    gallery: {
      eyebrow: "Gallery",
      title: "Photo Gallery",
      accentWord: "Gallery",
      lead: "Every sadhya, every stage and every picnic since 2012 — photographed by whoever had a camera that day. Search by face to find yourself in there.",
      link: { label: "View all albums", href: "/gallery" },
    },
    // from components/layout/reels-section.tsx — auto-hides until reels are
    // synced and featured, so this is safe to ship visible by default
    reels: {
      heading: "From Instagram",
      subheading: "The latest reels — tap any clip to watch it on Instagram.",
      maxCount: 8,
    },
    // from components/layout/leadership-row.tsx
    committee: {
      eyebrow: "Committee",
      title: "Our Committee",
      accentWord: "Committee",
      lead: "The volunteers who run KSA this year — with day jobs, families, and a shared stubbornness about keeping this going.",
      limit: 8,
    },
    // from components/layout/join-steps.tsx
    join: {
      eyebrow: "Membership",
      title: "How to Become a Member",
      accentWord: "Member",
      lead: "Three steps and one yearly fee, which pays for the halls, the sound system and the rice. Pay by card, or in cash at the next event.",
      cta: { label: "View All Plans", href: "/membership" },
      steps: [
        {
          title: "Choose a Plan",
          desc: "Individual, family or student — whichever fits your household. One fee covers the full year.",
        },
        {
          title: "Fill in the Form",
          desc: "Your name, where in or around Augsburg you live, and who is joining along with you.",
        },
        {
          title: "Get Your Confirmation",
          desc: "The committee reviews your application and sends your welcome email. After that you are on the list for everything.",
        },
      ],
    },
    // from the join band inline in app/(public)/page.tsx
    cta: {
      eyebrow: "Join us",
      title: "Become a Member of KSA",
      accentWord: "KSA",
      lead: "Join the families who keep this going — and get every invitation, every class and every celebration for the year ahead.",
      primaryCta: { label: "Apply for Membership", href: "/membership" },
      secondaryCta: { label: "Ask a Question First", href: "/contact" },
    },
    whatsappCta: {
      eyebrow: "Community Chat",
      title: "Join our WhatsApp Group",
      accentWord: "Group",
      lead: "Get every invitation, every class and every celebration directly in your chat. Stay updated and connected.",
    },
  },
};

/** Arrays that must never be left empty by a stored document — an admin who
 *  deletes every pillar gets the defaults back rather than a bare page. */
const LIST_FALLBACKS = {
  about: ["facts", "pillars"],
  join: ["steps"],
} as const;

/**
 * Spread each stored section over its defaults, so a document saved before a
 * field existed keeps rendering. Unknown section keys are dropped; empty
 * arrays fall back to the defaults. Pure and prisma-free so tests can import
 * it — see getHomeContent() in lib/home-actions.ts for the caller.
 */
export function mergeHomeContent(stored: unknown): HomeContentSections {
  const source = (stored ?? {}) as Record<string, Record<string, unknown>>;

  const merged = {} as HomeContentSections;

  for (const id of HOME_SECTION_IDS) {
    const defaults = DEFAULT_HOME_CONTENT.content[id] as Record<string, unknown>;
    const section = { ...defaults, ...(source[id] ?? {}) };

    for (const key of (LIST_FALLBACKS as Record<string, readonly string[]>)[id] ?? []) {
      const value = section[key];
      if (!Array.isArray(value) || value.length === 0) section[key] = defaults[key];
    }

    (merged as Record<string, unknown>)[id] = section;
  }

  return merged;
}
