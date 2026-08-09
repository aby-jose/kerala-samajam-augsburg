import { z } from "zod";

export const eventSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(5, "Title must be at least 5 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().min(3, "Location is required"),
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
