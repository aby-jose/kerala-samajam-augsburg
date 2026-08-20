import { z } from "zod";

/**
 * Soften a shouted venue name to normal case.
 *
 * Only all-caps values are touched. Somebody who typed "Pfarrsaal St. Anton"
 * chose that casing and it is left alone; "AT RONCALLIHAUS" is a caps-lock
 * slip, and the venue gets printed verbatim on the event page, in the
 * confirmation email and on the ticket PDF, where it reads as shouting.
 *
 * The trade-off is that an all-caps acronym typed on its own ("KSA HALL")
 * comes back as "Ksa Hall". That is recoverable — the admin can retype it with
 * one lowercase letter anywhere and this leaves the whole value alone — and it
 * is rarer than the caps-lock case it fixes.
 */
export function normalizeVenueCase(value: string): string {
  const trimmed = value.trim();

  // Any lowercase letter at all means the casing was deliberate.
  if (trimmed !== trimmed.toUpperCase()) return trimmed;

  // Latin-1 ranges rather than \p{L}: German venue names carry umlauts and ß.
  // Apostrophes sit inside the match so "JOHN'S" becomes "John's", not "John'S".
  return trimmed.replace(
    /[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’]*/g,
    (word) => word[0] + word.slice(1).toLowerCase()
  );
}

export const eventSponsorSchema = z.object({
  name: z.string().min(1, "Sponsor name is required"),
  logoUrl: z.string().min(1, "Logo is required"),
  websiteUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export type EventSponsorFormValue = z.infer<typeof eventSponsorSchema>;

export const eventSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(5, "Title must be at least 5 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  // Normalised on the schema rather than in `upsertEvent`, so the form and the
  // server action both get it from one place.
  location: z.string().min(3, "Location is required").transform(normalizeVenueCase),
  address: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  category: z.string().optional(),
  price: z.string().optional().refine(val => !val || (!isNaN(Number(val)) && Number(val) >= 0), "Price must be a valid positive number"),
  memberPrice: z.number().min(0).optional().nullable(),
  nonMemberPrice: z.number().min(0).optional().nullable(),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  requiresLogin: z.boolean().default(false),
  maxAttendees: z.number().int("Capacity must be a whole number").positive("Capacity must be positive").optional().nullable(),
  sponsors: z.array(eventSponsorSchema).default([]),
});

export type EventFormValues = z.infer<typeof eventSchema>;

export const membershipPlanSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Name is required"),
  description: z.string().optional().nullable(),
  price: z.number().min(0, "Price must be positive"),
  duration: z.string().default("YEARLY"),
  features: z.array(z.string()),
  isActive: z.boolean().default(true),
  isPopular: z.boolean().default(false),
});

export type MembershipPlanFormValues = z.infer<typeof membershipPlanSchema>;
