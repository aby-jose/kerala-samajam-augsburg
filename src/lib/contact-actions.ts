"use server";

import { z } from "zod";
import { prisma } from "./prisma";
import { sendEmail } from "./email";
import { verifyCaptcha, generateCaptcha } from "./captcha";
import { headers } from "next/headers";
import { getContactAdminNotificationEmail, getContactUserConfirmationEmail } from "./email-templates";
import { getServerSession } from "next-auth";
import { adminAuthOptions } from "./auth";
import { getConfig } from "./config-utils";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(5, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  captchaId: z.string().min(1, "Captcha ID is required"),
  captchaCode: z.string().min(6, "Captcha code is required"),
});

// Simple in-memory rate limiting (optional: use Redis in production)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT = 5; // 5 messages per hour
const LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

async function checkRateLimit(ip: string) {
  const now = Date.now();
  const limitInfo = rateLimitMap.get(ip);

  if (!limitInfo || now - limitInfo.lastReset > LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return true;
  }

  if (limitInfo.count >= RATE_LIMIT) {
    return false;
  }

  limitInfo.count += 1;
  return true;
}

export async function getContactCaptcha() {
  return generateCaptcha();
}

export async function submitContactForm(formData: z.infer<typeof contactSchema>) {
  const validatedFields = contactSchema.safeParse(formData);

  if (!validatedFields.success) {
    return { error: "Invalid form data", details: validatedFields.error.flatten() };
  }

  const { name, email, subject, message, captchaId, captchaCode } = validatedFields.data;

  // 1. Verify Captcha
  const isValidCaptcha = verifyCaptcha(captchaId, captchaCode);
  if (!isValidCaptcha) {
    return { error: "Security verification failed. Please try again." };
  }

  // 2. Rate Limiting
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for") || "unknown";
  const withinLimit = await checkRateLimit(ip);
  if (!withinLimit) {
    return { error: "Too many messages. Please try again later." };
  }

  try {
    // 3. Save to Database
    const savedMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message,
      },
    });

    // 4. Send Notification Email to Admin
    const config = await getConfig();
    await sendEmail({
      to: process.env.ADMIN_EMAIL || "abyjoseofficial@gmail.com",
      subject: `New Contact Message: ${subject} - ${config.siteName}`,
      html: getContactAdminNotificationEmail(name, email, subject, message, { 
        logoUrl: config.branding.logoUrl, 
        siteName: config.siteName,
        primaryColor: config.branding.primaryColor
      }),
    });

    // 5. Send Confirmation Email to User
    await sendEmail({
      to: email,
      subject: `We've received your message - ${config.siteName}`,
      html: getContactUserConfirmationEmail(name, subject, { 
        logoUrl: config.branding.logoUrl, 
        siteName: config.siteName,
        primaryColor: config.branding.primaryColor
      }),
    });

    return { success: true };
  } catch (error) {
    console.error("Contact form error:", error);
    return { error: "Failed to send message. Please try again later." };
  }
}

export async function getContactMessages() {
  const session = await getServerSession(adminAuthOptions);
  if (!session) throw new Error("Unauthorized");

  return await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function updateMessageStatus(id: string, status: "READ" | "UNREAD" | "ARCHIVED") {
  const session = await getServerSession(adminAuthOptions);
  if (!session) throw new Error("Unauthorized");

  await prisma.contactMessage.update({
    where: { id },
    data: { status },
  });

  return { success: true };
}

export async function deleteMessage(id: string) {
  const session = await getServerSession(adminAuthOptions);
  if (!session) throw new Error("Unauthorized");

  await prisma.contactMessage.delete({
    where: { id },
  });

  return { success: true };
}

