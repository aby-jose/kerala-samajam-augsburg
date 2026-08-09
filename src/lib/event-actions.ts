"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { uploadToCloudinary } from "./cloudinary";
import { eventSchema, type EventFormValues } from "./schemas";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth";
import { publicAuthOptions, adminAuthOptions } from "./auth";
import { generateCaptcha, verifyCaptcha } from "./captcha";
import { nanoid } from "nanoid";
import { stripe } from "./stripe";

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
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  return await prisma.event.findMany({
    include: {
      _count: {
        select: { registrations: true }
      }
    },
    orderBy: { date: 'desc' }
  });
}

export async function getPublicEvents() {
  return await prisma.event.findMany({
    where: { isPublished: true },
    orderBy: { date: 'asc' }
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
    orderBy: { date: 'asc' }
  });
}

export async function getEventBySlug(slug: string) {
  return await prisma.event.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { registrations: true }
      }
    }
  });
}

export async function upsertEvent(data: EventFormValues) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const validated = eventSchema.parse(data);
  const { id, ...eventData } = validated;

  let finalImageUrl = eventData.imageUrl;

  // Handle base64 image upload to Cloudinary
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
  };

  if (id) {
    await prisma.event.update({
      where: { id },
      data: prismaData,
    });
  } else {
    await prisma.event.create({
      data: prismaData,
    });
  }

  revalidatePath("/admin/events");
  revalidatePath("/events");
  if (validated.slug) {
    revalidatePath(`/events/${validated.slug}`);
  }
  
  return { success: true };
}

export async function deleteEvent(id: string) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.event.delete({
    where: { id },
  });
  
  revalidatePath("/admin/events");
  return { success: true };
}

export async function toggleEventPublish(id: string, isPublished: boolean) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.event.update({
    where: { id },
    data: { isPublished },
  });
  
  revalidatePath("/admin/events");
  return { success: true };
}

// Simple in-memory rate limiting (per process)
const generationLimits = new Map<string, { count: number, lastReset: number }>();

function checkRateLimit(key: string, limit: number = 10, windowMs: number = 60000) {
  const now = Date.now();
  const userLimit = generationLimits.get(key) || { count: 0, lastReset: now };
  
  if (now - userLimit.lastReset > windowMs) {
    userLimit.count = 0;
    userLimit.lastReset = now;
  }
  
  if (userLimit.count >= limit) {
    return false;
  }
  
  userLimit.count++;
  generationLimits.set(key, userLimit);
  return true;
}

/**
 * Generates an image using AI (Pollinations.ai as a high-fidelity provider)
 * Now uses Gemini to refine the prompt into a high-impact, URL-safe version first.
 */
export async function generateEventImage(prompt: string) {
  console.log("AI Image Generation Request:", prompt);
  
  if (!checkRateLimit('ai-img', 10, 60000)) {
    throw new Error("Rate limit exceeded for image generation. Please wait a minute.");
  }
  
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
  if (!checkRateLimit('ai-gen')) {
    throw new Error("Rate limit exceeded. Please wait a moment.");
  }
  
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
  if (!checkRateLimit('ai-gen')) throw new Error("Rate limit exceeded.");

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
  if (!checkRateLimit('ai-gen')) throw new Error("Rate limit exceeded.");

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
  if (!checkRateLimit('ai-gen')) throw new Error("Rate limit exceeded.");

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
  const { id, code } = generateCaptcha();
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
  paymentMethod: "STRIPE" | "CASH";
}) {
  const { eventId, name, email, phone, attendees, captchaId, captchaCode, paymentMethod } = data;

  // 1. Basic Validation
  if (!name || !email || !eventId || !captchaId || !captchaCode) {
    throw new Error("Missing required fields");
  }

  if (attendees < 1 || attendees > 10) {
    throw new Error("Invalid number of attendees (1-10 allowed)");
  }

  // 2. Verify Captcha
  const isCaptchaValid = verifyCaptcha(captchaId, captchaCode);
  if (!isCaptchaValid) {
    throw new Error("Invalid or expired captcha code. Please try again.");
  }

  // 3. Check Event Requirements
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { 
      id: true, 
      requiresLogin: true, 
      title: true, 
      maxAttendees: true, 
      memberPrice: true,
      nonMemberPrice: true,
      price: true,
      _count: { select: { registrations: true } } 
    }
  });

  if (!event) throw new Error("Event not found");

  // Check Capacity
  if (event.maxAttendees && event._count.registrations + attendees > event.maxAttendees) {
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
        status: "ACTIVE",
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
  // 6. Stripe Flow if applicable
  const totalAmount = finalPricePerPerson * attendees;

  if (totalAmount > 0 && paymentMethod === "STRIPE") {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "sepa_debit", "sofort"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Registration: ${event.title}`,
              description: `${attendees} Attendee(s)`,
            },
            unit_amount: Math.round(totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/events/${event.id}?success=true&ticket=PENDING`,
      cancel_url: `${baseUrl}/events/${event.id}?canceled=true`,
      metadata: {
        eventId,
        email: finalEmail,
        name: finalName,
        phone,
        attendees: attendees.toString(),
        type: "event_registration"
      }
    });

    return { success: true, method: "STRIPE", url: checkoutSession.url };
  }

  // 7. Create Registration (Cash or Free)
  try {
    const registration = await prisma.registration.create({
      data: {
        ticketId: `KSA-${nanoid(8).toUpperCase()}`,
        eventId,
        name: finalName,
        email: finalEmail,
        phone,
        attendees,
        pricePaid: totalAmount,
        paymentMethod: paymentMethod,
        paymentStatus: totalAmount > 0 ? "PENDING" : "PAID",
      }
    });

    if (registration.paymentStatus === "PAID") {
      try {
        const { sendEventTicket } = await import("./ticket-actions");
        await sendEventTicket(registration.id);
      } catch (ticketError) {
        console.error("Failed to auto-send free ticket:", ticketError);
      }
    }

    revalidatePath(`/events/${event.id}`);
    revalidatePath("/admin/events");
    
    return { success: true, method: "CASH", ticketId: registration.ticketId };
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

  revalidatePath(`/events/${registration.event.slug}`);
  revalidatePath("/admin/registrations");
  
  return { success: true };
}

export async function getRegistrationsByEvent(eventId?: string) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

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
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.registration.update({
    where: { id },
    data: { pricePaid: amount }
  });
  revalidatePath("/admin/registrations");
  return { success: true };
}

export async function toggleCheckIn(registrationId: string, isCheckedIn: boolean) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

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

export async function deleteRegistration(id: string) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.registration.delete({
    where: { id },
  });

  revalidatePath("/admin/registrations");
  return { success: true };
}

export async function getAdminDashboardStats() {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());

  const [
    totalRegistrations, 
    lastMonthRegistrations,
    upcomingEvents, 
    totalRevenueData, 
    lastMonthRevenueData,
    recentRegistrations,
    checkedInCount
  ] = await Promise.all([
    prisma.registration.count(),
    prisma.registration.count({ where: { createdAt: { gte: lastMonth } } }),
    prisma.event.count({ where: { date: { gte: now }, isPublished: true } }),
    prisma.registration.findMany({ select: { pricePaid: true } }),
    prisma.registration.findMany({ 
      where: { createdAt: { gte: lastMonth } },
      select: { pricePaid: true } 
    }),
    prisma.registration.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { event: { select: { title: true } } }
    }),
    prisma.registration.count({ where: { isCheckedIn: true } })
  ]);

  const totalRevenue = totalRevenueData.reduce((acc, reg) => acc + (reg.pricePaid || 0), 0);
  const lastMonthRevenue = lastMonthRevenueData.reduce((acc, reg) => acc + (reg.pricePaid || 0), 0);

  // Simple trend calculation
  const regTrend = totalRegistrations > 0 
    ? Math.round((lastMonthRegistrations / (totalRegistrations || 1)) * 100) 
    : 0;
    
  const revTrend = totalRevenue > 0 
    ? Math.round((lastMonthRevenue / (totalRevenue || 1)) * 100) 
    : 0;

  const eventStatus = await prisma.event.findMany({
    take: 3,
    where: { isPublished: true },
    include: { _count: { select: { registrations: true } } },
    orderBy: { date: 'asc' }
  });

  return {
    totalRegistrations,
    regTrend: `+${regTrend}%`,
    upcomingEvents,
    totalRevenue,
    revTrend: `+${revTrend}%`,
    recentRegistrations,
    checkedInCount,
    eventStatus: eventStatus.map(e => ({
      title: e.title,
      status: e.date > now ? "Upcoming" : "Past",
      progress: Math.min(Math.round((e._count.registrations / (e.maxAttendees || 100)) * 100), 100)
    }))
  };
}

export async function getRegistrationByTicketId(ticketId: string) {
  return await prisma.registration.findUnique({
    where: { ticketId },
    include: { event: { select: { title: true } } }
  });
}
