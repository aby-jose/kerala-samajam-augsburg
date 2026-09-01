import { z } from "zod";

import { sectionHeadingFields } from "./section";
import { LUCIDE_ICON_NAMES } from "../icons/lucide-icon-names";

/**
 * The icon picker's quick-pick suggestions for the benefit cards — the set
 * this section originally shipped with. Any lucide-react icon is a valid
 * choice (see LUCIDE_ICON_NAMES); these are just shown first.
 *
 * The first six are the ones membership-client.tsx uses today; Users and
 * Ticket are there so an admin adding a benefit has something to pick.
 */
export const MEMBERSHIP_ICON_FAVORITES = [
  "Globe",
  "HeartHandshake",
  "Sparkles",
  "GraduationCap",
  "Calendar",
  "Vote",
  "Users",
  "Ticket",
] as const;

/**
 * The Membership page as one editable document. `layout` owns order and
 * visibility; `content` owns the words and pictures, keyed by section id so
 * a field path never changes when a section moves — see
 * lib/page-content/membership-sections.ts for what each id renders as and
 * lib/page-layout.ts for the generic ordering rules shared with every other
 * page.
 */
export const MEMBERSHIP_SECTION_IDS = ["hero", "plans", "benefits", "whatsappCta"] as const;

export type MembershipSectionId = (typeof MEMBERSHIP_SECTION_IDS)[number];

export const membershipHeroSectionSchema = z.object({
  eyebrow: sectionHeadingFields.eyebrow,
  title: sectionHeadingFields.title,
  accentWord: sectionHeadingFields.accentWord,
  lead: sectionHeadingFields.lead,
});

export const membershipPlansSectionSchema = z.object({ ...sectionHeadingFields });

export const membershipBenefitsSectionSchema = z.object({
  ...sectionHeadingFields,
  imageUrl: z.string().min(1, "An image is required"),
  imageAlt: z.string().min(1, "Alt text is required").max(160),
  // The two stacked lines over the bottom of the image. Both optional: clear
  // them and the overlay stops rendering rather than leaving an empty block
  // sitting on the gradient.
  imageCaption: z.string().max(120).optional().or(z.literal("")),
  imageCaptionLabel: z.string().max(60).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        icon: z.enum(LUCIDE_ICON_NAMES),
        title: z.string().min(1, "Required").max(80),
        description: z.string().min(1, "Required").max(300),
      })
    )
    .min(1, "At least one benefit is required")
    .max(8),
});

export const membershipWhatsappCtaSectionSchema = z.object({ ...sectionHeadingFields });

export const membershipContentSchema = z.object({
  layout: z
    .array(
      z.object({
        id: z.enum(MEMBERSHIP_SECTION_IDS),
        visible: z.boolean(),
      })
    )
    .min(1),
  content: z.object({
    hero: membershipHeroSectionSchema,
    plans: membershipPlansSectionSchema,
    benefits: membershipBenefitsSectionSchema,
    whatsappCta: membershipWhatsappCtaSectionSchema,
  }),
});

export type MembershipContentT = z.infer<typeof membershipContentSchema>;
export type MembershipContentSections = MembershipContentT["content"];

/** The copy that lived in components/public/membership-client.tsx. */
export const DEFAULT_MEMBERSHIP: MembershipContentT = {
  layout: [
    { id: "hero", visible: true },
    { id: "plans", visible: true },
    { id: "benefits", visible: true },
    { id: "whatsappCta", visible: false },
  ],
  content: {
    hero: {
      eyebrow: "Membership",
      title: "Become a Member",
      accentWord: "Member",
      lead: "One fee for the year. It pays for the halls, the sound system and the rice — and it keeps the festivals, the classes and the stage running.",
    },
    plans: {
      eyebrow: "Plans",
      title: "Pick the one that fits",
      accentWord: "fits",
      lead: "A student on their own, a single member, or the whole family under one fee. Everything a tier covers is listed on it — no small print underneath.",
    },
    benefits: {
      eyebrow: "Benefits",
      title: "What Membership Gives You",
      accentWord: "Gives You",
      lead: "Members get the invitations first, a say in how the Verein is run, and a vote at the general meeting. Beyond that, it is the simplest way to keep all of this going.",
      imageUrl: "/images/gallery/community_picnic.png",
      imageAlt: "KSA members at a community gathering in Augsburg",
      imageCaption: "You won't be new here for long.",
      imageCaptionLabel: "Become a member",
      items: [
        {
          icon: "Globe",
          title: "Cultural Connection",
          description:
            "Stay deeply connected to Kerala's rich traditions through celebrations like Onam, Vishu, and Christmas.",
        },
        {
          icon: "HeartHandshake",
          title: "Community Network",
          description:
            "Build meaningful relationships with over 200+ Malayali families living in the Augsburg region.",
        },
        {
          icon: "Sparkles",
          title: "Support System",
          description:
            "Access a collective knowledge base for navigating life in Germany, from integration to professional growth.",
        },
        {
          icon: "GraduationCap",
          title: "Youth Development",
          description:
            "Provide your children with a platform to learn their heritage and develop leadership skills.",
        },
        {
          icon: "Calendar",
          title: "Event Access",
          description:
            "Get exclusive entry or discounted rates for KSA's year-round cultural workshops and gatherings.",
        },
        {
          icon: "Vote",
          title: "Citizen Voice",
          description:
            "Have your say in the organization's future through voting and participating in the General Body.",
        },
      ],
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
 *  deletes every benefit gets the defaults back rather than a bare section. */
const LIST_FALLBACKS = {
  benefits: ["items"],
} as const;

/**
 * Spread each stored section over its defaults, so a document saved before a
 * field existed keeps rendering. Unknown section keys are dropped; empty
 * arrays fall back to the defaults. Pure and prisma-free so tests can import
 * it — see getPageContent()/mergePageContent() for the caller.
 */
export function mergeMembershipContent(stored: unknown): MembershipContentSections {
  const source = (stored ?? {}) as Record<string, Record<string, unknown>>;

  const merged = {} as MembershipContentSections;

  for (const id of MEMBERSHIP_SECTION_IDS) {
    const defaults = DEFAULT_MEMBERSHIP.content[id] as Record<string, unknown>;
    const section = { ...defaults, ...(source[id] ?? {}) };

    for (const key of (LIST_FALLBACKS as Record<string, readonly string[]>)[id] ?? []) {
      const value = section[key];
      if (!Array.isArray(value) || value.length === 0) section[key] = defaults[key];
    }

    (merged as Record<string, unknown>)[id] = section;
  }

  return merged;
}
