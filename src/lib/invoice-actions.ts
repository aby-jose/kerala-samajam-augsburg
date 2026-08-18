import { prisma } from "@/lib/prisma";
import { generateInvoicePDF, type InvoiceStatus } from "./invoice-generator";
import { sendMail, templates } from "./email";
import { getConfig } from "./config-utils";
import { paymentDueDate, paymentReferenceFor, termLabel } from "./membership-term";

/**
 * Not a `"use server"` module — see the note in `ticket-actions.ts`.
 *
 * Exposed as an action, these would mail a member's invoice PDF to anyone who
 * could name a subscription id. They are called from server actions that have
 * already authorised the caller.
 *
 * Two documents, because without a gateway the member is billed before they
 * pay: a payable invoice carrying the bank details, and a receipt once an
 * administrator records that the money arrived.
 */

async function buildInvoice(subscriptionId: string, status: InvoiceStatus) {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { user: true, plan: true },
  });

  if (!sub || !sub.user.email) return null;

  const config = await getConfig();
  const shortId = sub.id.substring(sub.id.length - 8).toUpperCase();
  const reference = sub.paymentReference || paymentReferenceFor(sub.id, sub.user.name);

  const pdf = await generateInvoicePDF({
    invoiceNumber: `KSA-${status === "PAID" ? "REC" : "INV"}-${shortId}`,
    date: new Date(),
    dueDate: paymentDueDate(sub.createdAt, config.legal.paymentTermsDays),
    status,
    primaryColor: config.branding.primaryColor,
    paidOn: sub.startDate ?? undefined,
    issuer: {
      name: config.legal.entityName,
      street: config.legal.street,
      postalCode: config.legal.postalCode,
      city: config.legal.city,
      email: config.contactEmail,
    },
    member: {
      name: sub.user.name || "Member",
      email: sub.user.email,
      address: sub.user.address || undefined,
      city: sub.user.city || undefined,
      zip: sub.user.zip || undefined,
    },
    plan: {
      name: sub.plan.name,
      price: sub.plan.price,
      duration: sub.plan.duration,
    },
    paymentMethod: sub.paymentMethod,
    paymentReference: reference,
    bank: {
      accountHolder: config.legal.accountHolder,
      bankName: config.legal.bankName,
      iban: config.legal.iban,
      bic: config.legal.bic,
    },
  });

  return { sub, config, pdf, shortId, reference };
}

/** Sent when an application is accepted: how much, to where, quoting what. */
export async function sendMembershipPaymentRequest(subscriptionId: string) {
  try {
    const built = await buildInvoice(subscriptionId, "DUE");
    if (!built) {
      console.error("Subscription or user email not found for payment request");
      return { error: "Subscription not found" };
    }

    const { sub, config, pdf, shortId, reference } = built;

    const result = await sendMail({
      template: "payment.membership-request",
      to: sub.user.email!,
      entityId: sub.id,
      attachments: [
        {
          filename: `KSA_Invoice_${shortId}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
      build: (ctx) =>
        templates.payments.membershipPaymentRequest(ctx, {
          name: sub.user.name || "Member",
          planName: sub.plan.name,
          amount: sub.plan.price,
          reference,
          dueDate: paymentDueDate(sub.createdAt, config.legal.paymentTermsDays),
          method: sub.paymentMethod,
          bank: {
            accountHolder: config.legal.accountHolder,
            bankName: config.legal.bankName,
            iban: config.legal.iban,
            bic: config.legal.bic,
          },
        }),
    });

    if (!result.ok) return { error: result.error };
    return { success: true };
  } catch (error: any) {
    console.error("Error sending membership payment request:", error);
    return { error: error.message };
  }
}

/** Sent once an administrator records the payment — carries the term dates. */
export async function sendSubscriptionReceipt(subscriptionId: string) {
  try {
    const built = await buildInvoice(subscriptionId, "PAID");
    if (!built) {
      console.error("Subscription or user email not found for receipt");
      return { error: "Subscription not found" };
    }

    const { sub, pdf, shortId, reference } = built;

    const result = await sendMail({
      template: "payment.membership-received",
      to: sub.user.email!,
      entityId: sub.id,
      attachments: [
        {
          filename: `KSA_Receipt_${shortId}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
      build: (ctx) =>
        templates.payments.membershipPaymentReceived(ctx, {
          name: sub.user.name || "Member",
          planName: sub.plan.name,
          amount: sub.plan.price,
          startDate: sub.startDate,
          endDate: sub.endDate,
          term: termLabel(sub.plan.duration),
          reference,
        }),
    });

    if (!result.ok) return { error: result.error };
    return { success: true };
  } catch (error: any) {
    console.error("Error sending subscription receipt:", error);
    return { error: error.message };
  }
}
