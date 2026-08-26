"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

import { requirePermission } from "./guards";
import { displayStatus, isPaymentMethod, type PaymentMethod } from "./membership-term";
import { sendMail, templates } from "./email";
import { attachSubscriptionUsers } from "./subscription-users";

/**
 * The admin payments ledger.
 *
 * With no gateway this table is not a read-only report any more — it is where
 * money is actually recorded. Every row therefore carries enough state for the
 * page to decide whether "Record payment" applies to it.
 */
export type PaymentRecord = {
  id: string;
  type: "MEMBERSHIP" | "EVENT";
  userName: string;
  userEmail: string;
  amount: number;
  /** PAID | PENDING */
  status: string;
  /** BANK_TRANSFER | CASH */
  method: string;
  /** Bank reference or receipt number, else the ticket id. */
  reference: string;
  description: string;
  /** When the application or registration was made. */
  date: Date;
  /** When the money arrived — null until an administrator records it. */
  paidAt?: Date;
  note?: string;
  /** Membership term end. Absent for event registrations. */
  expiryDate?: Date;
  /** False while a student ID is still unverified, or once already paid. */
  canRecord: boolean;
  /** Why not, when `canRecord` is false and it is not simply already paid. */
  blockedReason?: string;
};

export async function getAllPayments(): Promise<PaymentRecord[]> {
  await requirePermission("payments.view");

  const [rawSubscriptions, registrations] = await Promise.all([
    prisma.subscription.findMany({
      include: { plan: { select: { name: true, price: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.registration.findMany({
      include: {
        event: { select: { title: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const subscriptions = await attachSubscriptionUsers(rawSubscriptions);

  const subPayments: PaymentRecord[] = subscriptions.map(sub => {
    const paid = sub.paymentStatus === "PAID";
    const awaitingId = sub.status === "PENDING_VERIFICATION";
    const rejected = sub.status === "REJECTED";

    return {
      id: sub.id,
      type: "MEMBERSHIP" as const,
      userName: sub.user.name || "Anonymous",
      userEmail: sub.user.email || "No Email",
      amount: sub.plan.price,
      status: sub.paymentStatus,
      method: sub.paymentMethod,
      reference: sub.paymentReference || "—",
      // Shows the membership state alongside the payment state, so a row that
      // cannot be actioned explains itself.
      description: `Membership: ${sub.plan.name}${paid ? "" : ` · ${labelStatus(displayStatus(sub))}`}`,
      date: sub.createdAt,
      paidAt: sub.startDate ?? undefined,
      note: sub.paymentNote ?? undefined,
      expiryDate: sub.endDate ?? undefined,
      canRecord: !paid && !awaitingId && !rejected,
      blockedReason: awaitingId
        ? "Student ID not verified yet"
        : rejected
          ? "Application was rejected"
          : undefined,
    };
  });

  const regPayments: PaymentRecord[] = registrations.map(reg => ({
    id: reg.id,
    type: "EVENT" as const,
    userName: reg.name,
    userEmail: reg.email,
    amount: reg.pricePaid || 0,
    status: reg.paymentStatus,
    method: reg.paymentMethod,
    reference: reg.paymentReference || reg.ticketId,
    description: `Event: ${reg.event.title}`,
    date: reg.createdAt,
    paidAt: reg.paidAt ?? undefined,
    // A free registration is booked as PAID and has nothing to collect.
    canRecord: reg.paymentStatus !== "PAID" && (reg.pricePaid || 0) > 0,
  }));

  return [...subPayments, ...regPayments].sort((a, b) => b.date.getTime() - a.date.getTime());
}

function labelStatus(status: string | null): string {
  if (!status) return "";
  return status
    .split("_")
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Record that an event fee was collected.
 *
 * Unlike a membership this starts nothing — the ticket was already issued at
 * registration — so it only settles the amount outstanding.
 */
export async function recordRegistrationPayment(
  registrationId: string,
  input: { receivedOn?: string | Date; method?: PaymentMethod; reference?: string } = {}
) {
  const admin = await requirePermission("payments.record");

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  });
  if (!registration) throw new Error("Registration not found");
  if (registration.paymentStatus === "PAID") throw new Error("This payment has already been recorded.");

  const receivedOn = input.receivedOn ? new Date(input.receivedOn) : new Date();
  if (Number.isNaN(receivedOn.getTime())) throw new Error("Invalid payment date");
  if (receivedOn.getTime() > Date.now()) throw new Error("The payment date cannot be in the future.");

  const method = isPaymentMethod(input.method) ? input.method : registration.paymentMethod;
  const reference = input.reference?.trim() || null;

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      paymentStatus: "PAID",
      paymentMethod: method,
      paidAt: receivedOn,
      paymentReference: reference,
      recordedById: admin.id,
      recordedAt: new Date(),
    },
  });

  // Tell them.
  //
  // This was the sharpest silence in the system: an administrator matched a
  // bank transfer, the row flipped to PAID, and the member was never told. They
  // went on holding a ticket that said "amount due at the door", with no
  // receipt and no way to know their transfer had been recognised.
  await sendMail({
    template: "payment.event-recorded",
    to: registration.email,
    entityId: registration.id,
    build: (ctx) =>
      templates.payments.eventPaymentRecorded(ctx, {
        name: registration.name,
        eventTitle: registration.event.title,
        eventSlug: registration.event.slug,
        ticketId: registration.ticketId,
        amount: registration.pricePaid || 0,
        method,
        paidAt: receivedOn,
        reference,
      }),
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/registrations");
  return { success: true };
}

export async function revertRegistrationPayment(registrationId: string) {
  await requirePermission("payments.revert");

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  });
  if (!registration) throw new Error("Registration not found");
  if (registration.paymentStatus !== "PAID") throw new Error("No recorded payment to undo.");

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      paymentStatus: "PENDING",
      paidAt: null,
      paymentReference: null,
      recordedById: null,
      recordedAt: null,
    },
  });

  // The member was told their payment had arrived. Reversing that quietly
  // means the desk asks them for money they believe they have already paid,
  // holding an email from us that says so.
  await sendMail({
    template: "payment.event-reverted",
    to: registration.email,
    entityId: registration.id,
    build: (ctx) =>
      templates.payments.eventPaymentReverted(ctx, {
        name: registration.name,
        eventTitle: registration.event.title,
        eventSlug: registration.event.slug,
        ticketId: registration.ticketId,
        amount: registration.pricePaid || 0,
      }),
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/registrations");
  return { success: true };
}
