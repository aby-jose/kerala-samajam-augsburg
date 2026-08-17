import { z } from "zod";

import { sectionHeadingFields } from "./section";

/**
 * Curated icon set for the benefit cards, same contract as ABOUT_ICONS: a
 * named tuple so the admin form offers a dropdown and the renderer never has
 * to guess whether a stored string is a real icon.
 *
 * The first six are the ones membership-client.tsx uses today; Users and
 * Ticket are there so an admin adding a benefit has something to pick.
 */
export const MEMBERSHIP_ICONS = [
  "Globe",
  "HeartHandshake",
  "Sparkles",
  "GraduationCap",
  "Calendar",
  "Vote",
  "Users",
  "Ticket",
] as const;

export const membershipContentSchema = z.object({
  hero: z.object({
    eyebrow: sectionHeadingFields.eyebrow,
    title: sectionHeadingFields.title,
    accentWord: sectionHeadingFields.accentWord,
    lead: sectionHeadingFields.lead,
  }),
  plans: z.object({ ...sectionHeadingFields }),
  benefits: z.object({
    ...sectionHeadingFields,
    imageUrl: z.string().min(1, "An image is required"),
    imageAlt: z.string().min(1, "Alt text is required").max(160),
    items: z
      .array(
        z.object({
          icon: z.enum(MEMBERSHIP_ICONS),
          title: z.string().min(1, "Required").max(80),
          description: z.string().min(1, "Required").max(300),
        })
      )
      .min(1, "At least one benefit is required")
      .max(8),
  }),
});

export type MembershipContentT = z.infer<typeof membershipContentSchema>;

/** The copy that lived in components/public/membership-client.tsx. */
export const DEFAULT_MEMBERSHIP: MembershipContentT = {
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
};
