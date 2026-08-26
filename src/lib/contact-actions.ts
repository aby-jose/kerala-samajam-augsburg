"use server";

import { z } from "zod";
import { prisma } from "./prisma";
import { sendMail, sendMailBatch, templates } from "./email";
import { verifyCaptcha, generateCaptcha } from "./captcha";
import { headers } from "next/headers";
import { requirePermission } from "./guards";
import { staffEmailsWithPermission } from "./rbac/staff-queries";
import { recordAnonymousConsent } from "./consent-recorder";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(5, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  captchaId: z.string().min(1, "Captcha ID is required"),
  captchaCode: z.string().min(6, "Captcha code is required"),
  // Art. 6(1)(a) GDPR — the sender must actively agree before we store their
  // message and reply to it.
  privacyConsent: z.literal(true, {
    message: "Please accept the Privacy Policy to send your message.",
  }),
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
  return await generateCaptcha();
}

export async function submitContactForm(formData: z.infer<typeof contactSchema>) {
  const validatedFields = contactSchema.safeParse(formData);

  if (!validatedFields.success) {
    return { error: "Invalid form data", details: validatedFields.error.flatten() };
  }

  const { name, email, subject, message, captchaId, captchaCode } = validatedFields.data;

  // 1. Verify Captcha
  const isValidCaptcha = await verifyCaptcha(captchaId, captchaCode);
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

    // The sender has no account, so the consent record is keyed by a hash of
    // their email — provable, without storing another copy of the address.
    try {
      await recordAnonymousConsent(email, "contact");
    } catch (consentError) {
      console.error("Failed to record contact consent:", consentError);
    }

    // 4. Notify every staff member who holds `inquiries.notify` — not just one
    // hardcoded address — and acknowledge to the sender.
    //
    // None of this is allowed to fail the request: the message is already
    // saved, so a mail outage should not tell a visitor their enquiry was
    // lost. Failures are recorded in the email log instead of thrown.
    const recipients = await staffEmailsWithPermission("inquiries.notify");
    if (recipients.length === 0) {
      console.error(
        "No staff hold inquiries.notify — contact form message has no notification recipient."
      );
    }

    await sendMailBatch(
      recipients.map((to) => ({
        to,
        entityId: savedMessage.id,
        build: (ctx) => templates.contact.contactAdminNotice(ctx, { name, email, subject, message }),
      })),
      { template: "contact.admin-notice" }
    );

    await sendMail({
      template: "contact.acknowledgement",
      to: email,
      entityId: savedMessage.id,
      build: (ctx) => templates.contact.contactAcknowledgement(ctx, { name, subject }),
    });

    return { success: true };
  } catch (error) {
    console.error("Contact form error:", error);
    return { error: "Failed to send message. Please try again later." };
  }
}

export async function getContactMessages() {
  await requirePermission("inquiries.view");

  return await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function updateMessageStatus(id: string, status: "READ" | "UNREAD" | "ARCHIVED") {
  await requirePermission("inquiries.manage");

  await prisma.contactMessage.update({
    where: { id },
    data: { status },
  });

  return { success: true };
}

export async function deleteMessage(id: string) {
  await requirePermission("inquiries.delete");

  await prisma.contactMessage.delete({
    where: { id },
  });

  return { success: true };
}

