import { z } from "zod";

/**
 * The About page as one editable document. `layout` owns order and
 * visibility; `content` owns the words and pictures, keyed by section id so
 * a field path never changes when a section moves — see
 * lib/about-sections.ts for what each id renders as and lib/page-layout.ts
 * for the generic ordering rules shared with every other page.
 */
export const ABOUT_SECTION_IDS = ["hero", "story", "committee", "closing", "whatsappCta"] as const;

export type AboutSectionId = (typeof ABOUT_SECTION_IDS)[number];

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

export const aboutHeroSectionSchema = z.object({
  eyebrow: z.string().min(1, "Required").max(60),
  title: z.string().min(1, "Required").max(160),
  // Word/phrase within `title` rendered in the accent color, e.g. "Kerala".
  // Falls back to plain text if empty or not found in `title`.
  // No `.default()` here — it would make the schema's input and output types
  // diverge, which react-hook-form's resolver rejects. getAboutContent()
  // always merges the defaults in.
  accentWord: z.string().max(60).optional().or(z.literal("")),
  lead: z.string().min(1, "Required"),
  heroImageUrl: z.string().min(1, "Hero image is required"),
});

export const aboutStorySectionSchema = z.object({
  eyebrow: z.string().min(1, "Required").max(60),
  title: z.string().min(1, "Required").max(160),
  accentWord: z.string().max(60).optional().or(z.literal("")),
  cards: z.array(aboutCardSchema).min(1, "At least one card is required").max(6),
});

// Neither section below has editable copy of its own today — committee
// lists live members and closing lists live events, both pulled at render
// time — but every id in ABOUT_SECTION_IDS still needs a content entry so
// the document shape (and the admin form's typed paths) stay uniform.
export const aboutCommitteeSectionSchema = z.object({});
export const aboutClosingSectionSchema = z.object({});

export const aboutContentSchema = z.object({
  layout: z
    .array(
      z.object({
        id: z.enum(ABOUT_SECTION_IDS),
        visible: z.boolean(),
      })
    )
    .min(1),
  content: z.object({
    hero: aboutHeroSectionSchema,
    story: aboutStorySectionSchema,
    committee: aboutCommitteeSectionSchema,
    closing: aboutClosingSectionSchema,
    whatsappCta: z.object({
      eyebrow: z.string().min(1, "Required").max(60),
      title: z.string().min(1, "Required").max(160),
      accentWord: z.string().max(60).optional().or(z.literal("")),
      lead: z.string().min(1, "Required"),
    }),
  }),
});

export type AboutContentT = z.infer<typeof aboutContentSchema>;
export type AboutContentSections = AboutContentT["content"];

// The copy that lived hardcoded in the page before this editor existed —
// used as the fallback until an admin saves their first edit, so nothing
// changes visually on day one. Every string below is transcribed
// character-for-character from the pre-restructure DEFAULT_ABOUT_CONTENT.
export const DEFAULT_ABOUT_CONTENT: AboutContentT = {
  layout: [
    { id: "hero", visible: true },
    { id: "story", visible: true },
    { id: "committee", visible: true },
    { id: "closing", visible: true },
    { id: "whatsappCta", visible: false },
  ],
  content: {
    hero: {
      eyebrow: "About us",
      title: "About Kerala Samajam Augsburg",
      accentWord: "Kerala",
      lead: "A registered Verein for Malayalis — the Mallu community — in Bavaria, run entirely by its members. We celebrate the festivals, teach the language to our children, and help people find their feet when they arrive in Augsburg.",
      heroImageUrl: "/images/about/hero.png",
    },
    story: {
      eyebrow: "Our story",
      title: "Where We Come From",
      accentWord: "Come From",
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
    },
    committee: {},
    closing: {},
    whatsappCta: {
      eyebrow: "Community Chat",
      title: "Join our WhatsApp Group",
      accentWord: "Group",
      lead: "Get every invitation, every class and every celebration directly in your chat. Stay updated and connected.",
    },
  },
};

/** Arrays that must never be left empty by a stored document — an admin who
 *  deletes every card gets the defaults back rather than a bare section. */
const LIST_FALLBACKS = {
  story: ["cards"],
} as const;

/**
 * Spread each stored section over its defaults, so a document saved before a
 * field existed keeps rendering. Unknown section keys are dropped; empty
 * arrays fall back to the defaults. Pure and prisma-free so tests can import
 * it — see getAboutContent() in lib/about-actions.ts for the caller.
 */
export function mergeAboutContent(stored: unknown): AboutContentSections {
  const source = (stored ?? {}) as Record<string, Record<string, unknown>>;

  const merged = {} as AboutContentSections;

  for (const id of ABOUT_SECTION_IDS) {
    const defaults = DEFAULT_ABOUT_CONTENT.content[id] as Record<string, unknown>;
    const section = { ...defaults, ...(source[id] ?? {}) };

    for (const key of (LIST_FALLBACKS as Record<string, readonly string[]>)[id] ?? []) {
      const value = section[key];
      if (!Array.isArray(value) || value.length === 0) section[key] = defaults[key];
    }

    (merged as Record<string, unknown>)[id] = section;
  }

  return merged;
}

/**
 * The document shape saved before sections were orderable: no `layout` and
 * no `content` key, because the document's own keys WERE the content — one
 * flat object, with the story fields prefixed (`storyEyebrow`, `storyTitle`,
 * `storyAccentWord`) to keep them apart from the hero's own
 * eyebrow/title/accentWord living in the same object. This is the exact
 * shape of AboutContent's one stored row as it existed before this
 * migration.
 */
type LegacyAboutContent = {
  eyebrow: string;
  title: string;
  accentWord?: string;
  lead: string;
  heroImageUrl: string;
  storyEyebrow: string;
  storyTitle: string;
  storyAccentWord?: string;
  cards: AboutCard[];
};

/** Drop keys whose value is `undefined`, so spreading the result over a
 *  defaults object can never clobber a real default with `undefined`. */
function definedEntries<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

/**
 * A document saved before sections were orderable has no `layout` key: its
 * own keys ARE the content. Lift it rather than merging it against the new
 * shape, where every field would read as unrecognised and be dropped —
 * silently reverting a page an administrator had already edited.
 *
 * Pure and prisma-free so a node-environment test can exercise the exact
 * logic getAboutContent() relies on — see lib/about-actions.ts for the
 * caller and the shape-detection branch (`!("layout" in stored) &&
 * !("content" in stored)`) that decides whether to call this at all.
 */
export function liftLegacyAboutContent(stored: Record<string, unknown>): {
  hero: Partial<AboutContentT["content"]["hero"]>;
  story: Partial<AboutContentT["content"]["story"]>;
} {
  const legacy = stored as Partial<LegacyAboutContent>;

  return {
    hero: definedEntries({
      eyebrow: legacy.eyebrow,
      title: legacy.title,
      accentWord: legacy.accentWord,
      lead: legacy.lead,
      heroImageUrl: legacy.heroImageUrl,
    }),
    story: definedEntries({
      eyebrow: legacy.storyEyebrow,
      title: legacy.storyTitle,
      accentWord: legacy.storyAccentWord,
      cards: legacy.cards,
    }),
  };
}
