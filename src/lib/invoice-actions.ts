"use server";

import { prisma } from "@/lib/prisma";
import { generateInvoicePDF } from "./invoice-generator";
import { sendEmail } from "./email";
import { getInvoiceEmail } from "./email-templates";
import { addYears } from "date-fns";
import { getConfig } from "./config-utils";

export async function sendSubscriptionInvoice(subscriptionId: string) {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        user: true,
        plan: true
      }
    });

    if (!sub || !sub.user.email) {
      console.error("Subscription or user email not found for invoice");
      return { error: "Subscription not found" };
    }

    const invoiceBuffer = await generateInvoicePDF({
      invoiceNumber: `KSA-INV-${sub.id.substring(sub.id.length - 8).toUpperCase()}`,
      date: new Date(),
      dueDate: new Date(),
      member: {
        name: sub.user.name || "Member",
        email: sub.user.email,
        address: sub.user.address || undefined,
        city: sub.user.city || undefined,
        zip: sub.user.zip || undefined
      },
      plan: {
        name: sub.plan.name,
        price: sub.plan.price,
        duration: sub.plan.duration
      },
      paymentMethod: sub.paymentMethod
    });

    const config = await getConfig();
    await sendEmail({
      to: sub.user.email,
      subject: `Your Membership Invoice - ${sub.plan.name} - ${config.siteName}`,
      html: getInvoiceEmail(sub.user.name || "Member", sub.plan.name, { 
        logoUrl: config.branding.logoUrl, 
        siteName: config.siteName,
        primaryColor: config.branding.primaryColor
      }),
      attachments: [
        {
          filename: `KSA_Invoice_${sub.id.substring(sub.id.length - 8).toUpperCase()}.pdf`,
          content: invoiceBuffer,
          contentType: "application/pdf"
        }
      ]
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error sending subscription invoice:", error);
    return { error: error.message };
  }
}
