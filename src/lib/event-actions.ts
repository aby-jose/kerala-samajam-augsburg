"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { deleteFromCloudinary, uploadToCloudinary } from "./cloudinary";
import { eventSchema, type EventFormValues } from "./schemas";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth";
import { publicAuthOptions } from "./auth";
import { requirePermission } from "./guards";
import { assertFeature } from "./feature-gate";
import { describeAudit } from "./rbac/audit";
import { generateCaptcha, verifyCaptcha } from "./captcha";
import { enforceRateLimit } from "./rate-limit";
import { generateTicketId } from "./ticket";
import { PAYMENT_METHODS, SUBSCRIPTION_STATUS, PENDING_STATUSES, isPaymentMethod, type PaymentMethod } from "./membership-term";
import { sendMail, sendMailBatch, templates } from "./email";
import { superAdminEmails } from "./rbac/staff-queries";
import { getCollectedRevenue } from "./revenue";
import { percentChange } from "./format-stats";
import type { Event, Registration } from "@prisma/client";

/** Shape the event templates need. Kept here so every broadcast agrees. */
const eventSummary = (event: Event) => ({
  slug: event.slug,
  title: event.title,
  date: event.date,
  startTime: event.startTime,
  endTime: event.endTime,
  location: event.location,
  address: event.address,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

async function generateContentWithFallback(prompt: string) {
  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite-001",
    "gemini-flash-latest"
  ];
  
  let lastError: any = null;
  
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result;
    } catch (error: any) {
      console.warn(`Model ${modelName} failed (${error.status || error.message}), trying next...`);
      lastError = error;
    }
  }
  
  throw lastError;
}

// Schema moved to schemas.ts

export async function getAdminEvents() {
  await requirePermission("events.view");

  return await prisma.event.findMany({
    include: {
      _count: {
        select: { registrations: true }
      },
      sponsors: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: { date: 'desc' }
  });
}

/**
 * Published events that have not happened yet, soonest first.
 * The cut-off is the start of today rather than "now", so an event still
 * shows on its own day instead of disappearing the moment it begins.
 */
export async function getUpcomingEvents() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return await prisma.event.findMany({
    where: { isPublished: true, date: { gte: startOfToday } },
    orderBy: { date: 'asc' },
    include: {
      // Logo + name now, not just an id — listing cards show the actual
      // sponsor, not a generic "sponsored" flag.
      sponsors: {
        orderBy: { order: "asc" },
        select: { id: true, name: true, logoUrl: true },
      },
    },
  });
}

export async function getEventBySlug(slug: string) {
  return await prisma.event.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { registrations: true }
      },
      sponsors: {
        orderBy: { order: "asc" },
      },
    }
  });
}

export async function upsertEvent(data: EventFormValues) {
  await requirePermission("events.edit");

  const validated = eventSchema.parse(data);
  const { id, sponsors, ...eventData } = validated;

  let finalImageUrl = eventData.imageUrl;

  // AI-generated covers arrive as a data URL — `generateEventImage` fetches the
  // image and returns it inline — so they still need uploading here. Files
  // chosen in the form no longer take this path: the modal uploads them via
  // `uploadImageAction` and submits a URL, which also gets them size and
  // type validation this branch has never had.
  if (eventData.imageUrl && eventData.imageUrl.startsWith("data:image")) {
    try {
      finalImageUrl = await uploadToCloudinary(eventData.imageUrl);
    } catch (error) {
      console.error("Cloudinary upload failed in server action:", error);
      // Fallback or handle error
    }
  }

  const prismaData = {
    ...eventData,
    imageUrl: finalImageUrl,
    date: new Date(validated.date),
    maxAttendees: validated.maxAttendees || null,
    // Sponsors are a small, admin-edited list fully replaced on every save
    // (design doc §7) — simplest correct sync, using the row order already
    // submitted from the form rather than trusting a client-supplied `order`.
    sponsors: {
      ...(id ? { deleteMany: {} } : {}),
      create: sponsors.map((sponsor, index) => ({
        name: sponsor.name,
        logoUrl: sponsor.logoUrl,
        websiteUrl: sponsor.websiteUrl ?? "",
        order: index,
      })),
    },
  };

  // The state before the edit, so a moved date or venue can be recognised as
  // such (date/location, below), and so a replaced cover image or dropped
  // sponsor logo can be told apart from one that's just carried over
  // unchanged (sponsors, further below) — both need the old row, not just
  // the new one.
  const before = id
    ? await prisma.event.findUnique({ where: { id }, include: { sponsors: true } })
    : null;

  let event: Event;
  if (id) {
    event = await prisma.event.update({
      where: { id },
      data: prismaData,
    });
  } else {
    event = await prisma.event.create({
      data: prismaData,
    });
  }

  if (before) {
    // Sponsors are fully replaced above (deleteMany + create), so any old
    // logo not present in the new list is gone for good from the DB side —
    // best-effort here is what stops it from also lingering, orphaned, on
    // Cloudinary. Same for a replaced cover image.
    const newLogoUrls = new Set(sponsors.map((s) => s.logoUrl));
    const orphaned = [
      ...(before.imageUrl && before.imageUrl !== finalImageUrl ? [before.imageUrl] : []),
      ...(before.sponsors ?? []).filter((s) => !newLogoUrls.has(s.logoUrl)).map((s) => s.logoUrl),
    ];
    await Promise.all(orphaned.map((url) => deleteFromCloudinary(url)));
  }

  let notified = 0;
  if (before) {
    const dateMoved = before.date.getTime() !== event.date.getTime();
    const venueMoved = before.location !== event.location;

    if ((dateMoved || venueMoved) && event.status !== "CANCELLED") {
      const result = await notifyRegistrants(event.id, (registration) => ({
        to: registration.email,
        entityId: registration.id,
        build: (ctx: any) =>
          templates.events.eventRescheduled(ctx, {
            name: registration.name,
            event: eventSummary(event),
            previousDate: dateMoved ? before.date : null,
            previousLocation: venueMoved ? before.location : null,
          }),
      }), "event.rescheduled");
      notified = result.sent;
    }
  }

  revalidatePath("/admin/events");
  revalidatePath("/events");
  if (validated.slug) {
    revalidatePath(`/events/${validated.slug}`);
  }

  return { success: true, notified };
}

/**
 * Fan a template out to everyone holding a registration for an event.
 *
 * Extracted because four different callers need it and each one getting the
 * batching, the ordering and the failure handling right on its own is four
 * chances to get it wrong.
 */
async function notifyRegistrants(
  eventId: string,
  build: (registration: Registration) => {
    to: string;
    entityId: string;
    build: (ctx: any) => any;
  },
  template: string
) {
  const registrations = await prisma.registration.findMany({ where: { eventId } });
  if (!registrations.length) return { sent: 0, skipped: 0, failed: 0, errors: [] };

  return sendMailBatch(registrations.map(build), { template });
}

/**
 * Call the event off, and tell everyone who was coming.
 *
 * Cancelling and deleting used to be the same operation, which meant the only
 * way to stop an event also destroyed the list of people who needed to hear
 * about it. The row and its registrations stay; the status changes.
 */
export async function cancelEvent(id: string, reason?: string) {
  await requirePermission("events.cancel");

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new Error("Event not found");
  if (event.status === "CANCELLED") throw new Error("This event is already cancelled.");

  await describeAudit({
    summary: `Cancelled "${event.title}"`,
    entity: "Event",
    entityId: event.id,
    metadata: { reason: reason ?? null },
  });

  const cancelled = await prisma.event.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancellationReason: reason?.trim() || null,
      cancelledAt: new Date(),
    },
  });

  const outcome = await notifyRegistrants(
    id,
    (registration) => ({
      to: registration.email,
      entityId: registration.id,
      build: (ctx: any) =>
        templates.events.eventCancelled(ctx, {
          name: registration.name,
          event: eventSummary(cancelled),
          reason: reason?.trim() || undefined,
          hadPaid: registration.paymentStatus === "PAID",
        }),
    }),
    "event.cancelled"
  );

  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath(`/events/${event.slug}`);

  return { success: true, notified: outcome.sent, failed: outcome.failed };
}

/** Undo a cancellation. Registrants are told it is back on. */
export async function reinstateEvent(id: string) {
  await requirePermission("events.cancel");

  const event = await prisma.event.update({
    where: { id },
    data: { status: "SCHEDULED", cancellationReason: null, cancelledAt: null },
  });

  const outcome = await notifyRegistrants(
    id,
    (registration) => ({
      to: registration.email,
      entityId: registration.id,
      build: (ctx: any) =>
        templates.events.eventRescheduled(ctx, {
          name: registration.name,
          event: eventSummary(event),
          reason: "This event was cancelled and is now going ahead after all. Your original ticket is valid.",
        }),
    }),
    "event.reinstated"
  );

  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath(`/events/${event.slug}`);

  return { success: true, notified: outcome.sent };
}

export async function deleteEvent(id: string) {
  await requirePermission("events.delete");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { _count: { select: { registrations: true } }, sponsors: true },
  });
  if (!event) throw new Error("Event not found");

  // Deleting an event that people have booked *is* a cancellation as far as
  // they are concerned — and once the row is gone there is no list left to
  // mail. So the notice goes out first, and only then the row.
  let notified = 0;
  if (event._count.registrations > 0 && event.status !== "CANCELLED") {
    const outcome = await notifyRegistrants(
      id,
      (registration) => ({
        to: registration.email,
        entityId: registration.id,
        build: (ctx: any) =>
          templates.events.eventCancelled(ctx, {
            name: registration.name,
            event: eventSummary(event),
            hadPaid: registration.paymentStatus === "PAID",
          }),
      }),
      "event.cancelled"
    );
    notified = outcome.sent;
  }

  await prisma.registration.deleteMany({ where: { eventId: id } });
  await prisma.event.delete({ where: { id } });

  // Sponsors cascade on the relation (`onDelete: Cascade`), so the DB rows
  // are already gone — this is the Cloudinary half, which nothing else does.
  const orphaned = [event.imageUrl, ...event.sponsors.map((s) => s.logoUrl)].filter(
    (url): url is string => !!url
  );
  await Promise.all(orphaned.map((url) => deleteFromCloudinary(url)));

  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { success: true, notified };
}

export async function toggleEventPublish(id: string, isPublished: boolean) {
  await requirePermission("events.publish");

  const event = await prisma.event.update({
    where: { id },
    data: { isPublished },
  });

  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { success: true, event };
}

/**
 * Manually close (or reopen) sign-ups, independent of `maxAttendees`.
 *
 * Capacity is normally worked out from the registration count, which has
 * nothing to say about an event with no cap set, or one that needs to stop
 * taking names before the numbers do it automatically. No notification goes
 * out — existing registrants keep their place either way, so there is
 * nothing to tell them.
 */
export async function toggleEventFull(id: string, registrationsFull: boolean) {
  await requirePermission("events.edit");

  const event = await prisma.event.update({
    where: { id },
    data: { registrationsFull },
  });

  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath(`/events/${event.slug}`);
  return { success: true, event };
}

/**
 * Announce a published event to members who want to hear about them.
 *
 * Kept as a separate, explicitly-invoked action rather than a side effect of
 * publishing: publishing is toggled during editing, and an announcement that
 * fires on every toggle would mail the membership several times for one event.
 * `once` makes a second press harmless anyway.
 */
export async function announceEvent(id: string) {
  await requirePermission("events.announce");

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new Error("Event not found");
  if (!event.isPublished) throw new Error("Publish the event before announcing it.");
  if (event.status === "CANCELLED") throw new Error("This event is cancelled.");

  await describeAudit({
    summary: `Announced "${event.title}" to the membership`,
    entity: "Event",
    entityId: event.id,
  });

  // Members with a running subscription, plus anyone verified who has asked to
  // hear about events. `sendMail` re-checks the preference per recipient, so
  // this query only has to be roughly right.
  const recipients = await prisma.user.findMany({
    where: {
      email: { not: null },
      emailVerified: { not: null },
      status: "ACTIVE",
      anonymizedAt: null,
      emailEventAnnouncements: true,
    },
    select: { id: true, name: true, email: true },
  });

  const outcome = await sendMailBatch(
    recipients.map((user) => ({
      to: user.email!,
      entityId: `${event.id}:${user.id}`,
      build: (ctx: any) =>
        templates.events.eventAnnouncement(ctx, {
          name: user.name || "there",
          event: eventSummary(event),
          description: event.description,
          memberPrice: event.memberPrice,
          nonMemberPrice: event.nonMemberPrice,
        }),
    })),
    { template: "event.announcement", category: "announcement", once: true }
  );

  return { success: true, ...outcome };
}

/**
 * Admin-only entry point for the AI helpers, with a per-administrator budget.
 *
 * These call Gemini and an external image generator on our API keys, so they
 * spend real money. They were reachable without a session, and the limiter was
 * keyed on the literal string `'ai-img'` — one global bucket for the whole
 * site, reset by every cold start. Keying on the caller makes the limit mean
 * something, and requiring an administrator means only a handful of people can
 * reach it at all.
 */
async function requireAiCaller(bucket: string, limit = 10, windowMs = 60_000) {
  const admin = await requirePermission("events.ai");
  enforceRateLimit(
    `ai:${bucket}:${admin.id ?? admin.email ?? "unknown"}`,
    limit,
    windowMs,
    "Rate limit exceeded for AI generation. Please wait a minute."
  );
  return admin;
}

/**
 * Generates an image using AI (Pollinations.ai as a high-fidelity provider)
 * Now uses Gemini to refine the prompt into a high-impact, URL-safe version first.
 */
export async function generateEventImage(prompt: string) {
  console.log("AI Image Generation Request:", prompt);
  
  await requireAiCaller("image", 10, 60_000);
  
  try {
    // 1. Use Gemini to condense the prompt into a high-impact image generation prompt
    const refinerPrompt = `Convert this event description into a CONCISE (max 15 words) high-impact image generation prompt for a photorealistic cinematic visual. 
    Focus on the visual elements. Event: "${prompt}".
    Write ONLY in English.
    Return ONLY the refined prompt string, no quotes or explanation.`;
    
    let visualPrompt = prompt;
    try {
      const refinement = await generateContentWithFallback(refinerPrompt);
      const text = refinement.response.text().trim();
      visualPrompt = text.replace(/["']/g, '');
      console.log("Gemini Refined Prompt:", visualPrompt);
    } catch (err) {
      console.error("Gemini prompt refinement failed, using fallback cleaning:", err);
    }

    // 2. Clean and truncate the prompt for the engine - be VERY strict with characters
    const cleanPrompt = visualPrompt
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove EVERYTHING except letters, numbers and spaces
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .trim()
      .substring(0, 150);             // Keep it short and sweet
    
    console.log("Final Engine Prompt:", cleanPrompt);
    
    // 3. Use a high-entropy random seed
    const seed = Math.floor(Math.random() * 999999);
    
    // 4. Encode the prompt safely
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    
    // 5. Using pollinations.ai with the Flux model which is state of the art
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&seed=${seed}&model=flux&nologo=true`;
    
    console.log("Generated AI Image URL:", url);
    
    // Fetch the image on the server to ensure it's generated and avoid browser loading errors
    const imageResponse = await fetch(url, { redirect: 'follow' });
    if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    const arrayBuffer = await imageResponse.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
        throw new Error("Received empty image from Pollinations.ai");
    }
    
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    return `data:${mimeType};base64,${base64Image}`;
  } catch (error) {
    console.error("Critical error in generateEventImage:", error);
    // Return a high-quality fallback image that is distinct
    return "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop";
  }
}

/**
 * Generates event metadata (description, category, etc) using Gemini
 */
export async function generateEventDetails(title: string) {
  if (!title) return null;
  await requireAiCaller("text");
  
  const prompt = `Generate event details specifically for an event titled "${title}" for "Kerala Samajam Augsburg", a community organization for Keralites in Augsburg, Germany.
  The description MUST be directly related to the title "${title}".
  Write ONLY in English. Do NOT use Malayalam or any other language.
  Return a JSON object with:
  - description: A vibrant, professional, and inviting description (2-3 paragraphs) that captures the spirit of ${title}.
  - category: One of [Cultural, Sports, Religious, Social, Meeting, Other].
  - suggestedLocation: A typical location name if relevant.
  - suggestedPrice: A suggested numeric entry fee in Euros (e.g. "0" for Free, "10" for €10). MUST be a string containing only digits.
  Only return the raw JSON object, no markdown formatting.`;

  try {
    const result = await generateContentWithFallback(prompt);
    const text = result.response.text();
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("AI Generation failed:", error);
    throw error;
  }
}

/**
 * Refines the event title to be more catchy and professional
 */
export async function improveEventTitle(title: string) {
  if (!title) return title;
  await requireAiCaller("text");

  const prompt = `Rewrite this event title to be more professional, catchy, and suitable for a community portal: "${title}". 
  Write ONLY in English. Do NOT use Malayalam or any other language.
  Keep it concise (max 10 words). Return ONLY the refined title string.`;

  try {
    const result = await generateContentWithFallback(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("AI Title Improvement failed:", error);
    return title;
  }
}

/**
 * Refines the event description based on the title and current description
 */
export async function improveEventDescription(description: string, title?: string) {
  if (!description && !title) return description;
  await requireAiCaller("text");

  const context = title ? `for an event titled "${title}"` : "";
  const prompt = `Enhance and professionalize this event description ${context}: "${description || "Come and join us for this special event!"}". 
  The enhanced text MUST be specifically tailored to "${title || "the event"}" and be well-structured for a Kerala community organization. 
  Use a warm and inviting tone. Write ONLY in English. Do NOT use Malayalam or any other language. Return ONLY the enhanced description text.`;

  try {
    const result = await generateContentWithFallback(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("AI Description Improvement failed:", error);
    return description;
  }
}

/**
 * Generates only the category
 */
export async function generateCategory(title: string, description: string) {
  if (!title) return "Other";
  await requireAiCaller("text");

  const prompt = `Based on the title "${title}" and description "${description}", choose the best category from: [Cultural, Sports, Religious, Social, Meeting, Other]. 
  Write ONLY in English. Return ONLY the category name.`;

  try {
    const result = await generateContentWithFallback(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("AI Category Generation failed:", error);
    return "Other";
  }
}

/**
 * REGISTRATION ACTIONS
 */

export async function getCaptcha() {
  const { id, code } = await generateCaptcha();
  // In a real app, we might generate an image. 
  // For simplicity and accessibility here, we return the text code.
  // The client will display it and user will type it back.
  return { id, code };
}

export async function registerForEvent(data: {
  eventId: string;
  name: string;
  email: string;
  phone: string;
  attendees: number;
  captchaId: string;
  captchaCode: string;
  /** How the attendee intends to settle up. Nothing is charged here. */
  paymentMethod?: PaymentMethod;
}) {
  // Hiding the form is not enough — this action is reachable directly, and a
  // registration accepted while the module is off would produce a ticket and
  // an email for an event nobody is taking sign-ups for.
  await assertFeature("enableRegistration");

  const { eventId, name, email, phone, attendees, captchaId, captchaCode } = data;
  const paymentMethod = isPaymentMethod(data.paymentMethod)
    ? data.paymentMethod
    : PAYMENT_METHODS.CASH;

  // 1. Basic Validation
  if (!name || !email || !eventId || !captchaId || !captchaCode) {
    throw new Error("Missing required fields");
  }

  if (attendees < 1 || attendees > 10) {
    throw new Error("Invalid number of attendees (1-10 allowed)");
  }

  // 2. Verify Captcha
  const isCaptchaValid = await verifyCaptcha(captchaId, captchaCode);
  if (!isCaptchaValid) {
    throw new Error("Invalid or expired captcha code. Please try again.");
  }

  // 3. Check Event Requirements
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { registrations: true } } },
  });

  if (!event) throw new Error("Event not found");

  if (event.status === "CANCELLED") {
    throw new Error("This event has been cancelled and is no longer taking registrations.");
  }

  if (event.registrationsFull) {
    await sendMail({
      template: "event.full",
      to: email,
      entityId: event.id,
      build: (ctx) =>
        templates.events.eventFull(ctx, { name: name || "there", event: eventSummary(event) }),
    });
    throw new Error("Sorry, this event has reached its maximum capacity.");
  }

  // Check Capacity
  if (event.maxAttendees && event._count.registrations + attendees > event.maxAttendees) {
    // Somebody filled in a form and got a red error message. Sending them the
    // details anyway means they can watch the page for a returned place
    // instead of assuming the whole thing failed.
    await sendMail({
      template: "event.full",
      to: email,
      entityId: event.id,
      build: (ctx) =>
        templates.events.eventFull(ctx, { name: name || "there", event: eventSummary(event) }),
    });
    throw new Error("Sorry, this event has reached its maximum capacity.");
  }

  // 4. Session Check if Required
  const session = await getServerSession(publicAuthOptions);
  
  // Check for active subscription
  let hasActiveSubscription = false;
  if (session?.user?.id) {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id as string,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        endDate: { gte: new Date() }
      }
    });
    hasActiveSubscription = !!sub;
  }

  if (event.requiresLogin && !session) {
    throw new Error("This event is for members only. Please log in to register.");
  }

  // If logged in, we should ideally use session data to override name/email for security
  // but let's assume the client pre-filled it and we just double check if session exists.
  // A stricter check:
  const finalName = session ? (session.user as any).name : name;
  const finalEmail = session ? (session.user as any).email : email;

  // 4.5 Calculate Price
  let finalPricePerPerson = 0;
  if (hasActiveSubscription) {
    finalPricePerPerson = event.memberPrice ?? 0;
  } else {
    finalPricePerPerson = event.nonMemberPrice ?? 0;
    // Fallback to legacy price if nonMemberPrice is not set
    if (event.nonMemberPrice === null && event.price && !isNaN(parseFloat(event.price))) {
      finalPricePerPerson = parseFloat(event.price);
    }
  }
  const totalAmount = finalPricePerPerson * attendees;

  // 6. Create the registration.
  //
  // There is no online payment: a paid registration is booked as PENDING and
  // settled in person or by transfer, and an administrator records it. The
  // ticket is still issued straight away — withholding it would mean nobody
  // could be let in until every payment had been keyed in beforehand — so it
  // carries the amount still owed instead.
  try {
    const registration = await prisma.registration.create({
      data: {
        ticketId: generateTicketId(),
        eventId,
        name: finalName,
        email: finalEmail,
        phone,
        attendees,
        pricePaid: totalAmount,
        paymentMethod,
        paymentStatus: totalAmount > 0 ? "PENDING" : "PAID",
      }
    });

    try {
      const { sendEventTicket } = await import("./ticket-actions");
      await sendEventTicket(registration.id);
    } catch (ticketError) {
      console.error("Failed to auto-send ticket:", ticketError);
    }

    revalidatePath(`/events/${event.id}`);
    revalidatePath("/admin/events");
    revalidatePath("/admin/payments");

    return {
      success: true,
      ticketId: registration.ticketId,
      amountDue: totalAmount,
      paymentMethod,
    };
  } catch (err: any) {
    if (err.code === 'P2002') {
      throw new Error("You are already registered for this event.");
    }
    throw new Error("Registration failed. Please try again.");
  }
}

export async function getUserRegistrationStatus(eventId: string) {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.email) return { isRegistered: false };

  const registration = await prisma.registration.findFirst({
    where: {
      eventId,
      email: session.user.email,
    },
  });

  return {
    isRegistered: !!registration,
    registration: registration,
  };
}

export async function cancelRegistration(registrationId: string) {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.email) throw new Error("Authentication required");

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  });

  if (!registration) throw new Error("Registration not found");
  if (registration.email !== session.user.email) throw new Error("Unauthorized");

  await prisma.registration.delete({
    where: { id: registrationId },
  });

  // Confirm it to the member, and tell the committee — a released place that
  // nobody knows about is a place that stays empty, and a released place that
  // was paid for is a refund somebody has to remember to make.
  await sendMail({
    template: "event.registration-cancelled",
    to: registration.email,
    entityId: registration.id,
    build: (ctx) =>
      templates.events.registrationCancelled(ctx, {
        name: registration.name,
        event: eventSummary(registration.event),
        ticketId: registration.ticketId,
      }),
  });

  const committee = await superAdminEmails();
  await sendMailBatch(
    committee.map((to) => ({
      to,
      entityId: registration.id,
      build: (ctx) =>
        templates.events.registrationCancelledAdminNotice(ctx, {
          name: registration.name,
          email: registration.email,
          event: eventSummary(registration.event),
          attendees: registration.attendees,
          hadPaid: registration.paymentStatus === "PAID",
        }),
    })),
    { template: "event.registration-cancelled.admin" }
  );

  revalidatePath(`/events/${registration.event.slug}`);
  revalidatePath("/admin/registrations");

  return { success: true };
}

export async function getRegistrationsByEvent(eventId?: string) {
  await requirePermission("registrations.view");

  return await prisma.registration.findMany({
    where: eventId ? { eventId } : {},
    include: {
      event: {
        select: {
          title: true,
          memberPrice: true,
          nonMemberPrice: true,
        }
      }
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateRegistrationAmount(id: string, amount: number) {
  await requirePermission("registrations.edit");

  await prisma.registration.update({
    where: { id },
    data: { pricePaid: amount }
  });
  revalidatePath("/admin/registrations");
  return { success: true };
}

/**
 * Event dates are stored as UTC midnight of the calendar day picked in the
 * admin form (`new Date("YYYY-MM-DD")`), so "today" must be compared by UTC
 * date parts rather than elapsed time — a local-timezone comparison would
 * shift the allowed window by hours in either direction.
 */
function isSameUTCDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export async function toggleCheckIn(registrationId: string, isCheckedIn: boolean) {
  await requirePermission("registrations.checkin");

  if (isCheckedIn) {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: { event: { select: { date: true } } },
    });

    if (!registration) throw new Error("Registration not found");

    if (!isSameUTCDay(registration.event.date, new Date())) {
      const eventDate = registration.event.date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      throw new Error(`Check-in is only allowed on the day of the event (${eventDate}).`);
    }
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      isCheckedIn,
      checkInTime: isCheckedIn ? new Date() : null,
    },
  });

  revalidatePath("/admin/registrations");
  return { success: true };
}

/**
 * An administrator removes somebody's registration.
 *
 * The person losing their place is told. Previously they were not, which meant
 * they turned up at the door holding a ticket that had been void for a week.
 */
export async function deleteRegistration(id: string, reason?: string) {
  await requirePermission("registrations.delete");

  const registration = await prisma.registration.findUnique({
    where: { id },
    include: { event: true },
  });
  if (!registration) throw new Error("Registration not found");

  await describeAudit({
    summary: `Deleted ${registration.name}'s registration for "${registration.event.title}"`,
    entity: "Registration",
    entityId: registration.id,
    metadata: { reason: reason ?? null, attendees: registration.attendees },
  });

  await prisma.registration.delete({ where: { id } });

  await sendMail({
    template: "event.registration-removed",
    to: registration.email,
    entityId: registration.id,
    build: (ctx) =>
      templates.events.registrationRemovedByAdmin(ctx, {
        name: registration.name,
        event: eventSummary(registration.event),
        ticketId: registration.ticketId,
        reason: reason?.trim() || undefined,
      }),
  });

  revalidatePath("/admin/registrations");
  revalidatePath(`/events/${registration.event.slug}`);
  return { success: true };
}

export async function getAdminDashboardStats() {
  await requirePermission("dashboard.view");

  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

  const [
    totalRegistrations,
    priorRegistrations,
    upcomingEventsCount,
    totalRevenue,
    priorRevenue,
    recentRegistrations,
    checkedInCount,
    pendingPayments,
    pendingMembership,
    unreadInquiries,
    pendingContributions,
    upcomingEvents,
  ] = await Promise.all([
    prisma.registration.count(),
    prisma.registration.count({ where: { createdAt: { lt: monthAgo } } }),
    prisma.event.count({ where: { date: { gte: now }, isPublished: true, status: { not: "CANCELLED" } } }),
    getCollectedRevenue(),
    getCollectedRevenue(monthAgo),
    prisma.registration.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { event: { select: { title: true } } }
    }),
    prisma.registration.count({ where: { isCheckedIn: true } }),
    prisma.registration.count({ where: { paymentStatus: "PENDING" } }),
    prisma.subscription.count({ where: { status: { in: PENDING_STATUSES } } }),
    prisma.contactMessage.count({ where: { status: "UNREAD" } }),
    prisma.mediaContribution.count({ where: { status: "PENDING" } }),
    prisma.event.findMany({
      take: 4,
      where: { date: { gte: now }, isPublished: true, status: { not: "CANCELLED" } },
      include: { _count: { select: { registrations: true } } },
      orderBy: { date: 'asc' }
    }),
  ]);

  return {
    totalRegistrations,
    regTrend: percentChange(totalRegistrations, priorRegistrations),
    upcomingEvents: upcomingEventsCount,
    totalRevenue,
    revTrend: percentChange(totalRevenue, priorRevenue),
    recentRegistrations,
    checkedInCount,
    checkInRate: totalRegistrations > 0 ? Math.round((checkedInCount / totalRegistrations) * 100) : null,
    // Items that need an admin to actually do something, surfaced up front
    // instead of only discoverable by visiting each section in turn.
    attention: [
      {
        key: "payments",
        label: "Payments awaiting confirmation",
        count: pendingPayments,
        href: "/admin/payments",
        tone: "amber" as const,
      },
      {
        key: "membership",
        label: "Membership applications pending",
        count: pendingMembership,
        href: "/admin/membership/applications",
        tone: "violet" as const,
      },
      {
        key: "inquiries",
        label: "Unread inquiries",
        count: unreadInquiries,
        href: "/admin/inquiries",
        tone: "blue" as const,
      },
      {
        key: "contributions",
        label: "Gallery photos awaiting review",
        count: pendingContributions,
        href: "/admin/gallery/contributions",
        tone: "emerald" as const,
      },
    ],
    upcomingEventsList: upcomingEvents.map(e => ({
      id: e.id,
      title: e.title,
      date: e.date,
      location: e.location,
      registrations: e._count.registrations,
      maxAttendees: e.maxAttendees,
    })),
  };
}

/**
 * Look up a registration from a scanned ticket. Admin-only: it returns the
 * holder's name, email and phone, and it was reachable by anyone with a ticket
 * id — which the QR code on every printed ticket carries in plain text.
 */
export async function getRegistrationByTicketId(ticketId: string) {
  await requirePermission("registrations.checkin");

  return await prisma.registration.findUnique({
    where: { ticketId },
    include: { event: { select: { title: true } } }
  });
}
