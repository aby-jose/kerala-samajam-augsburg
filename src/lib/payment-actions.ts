"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { adminAuthOptions } from "./auth";
import { isAfter, addHours } from "date-fns";

export type PaymentRecord = {
  id: string;
  type: "MEMBERSHIP" | "EVENT";
  userName: string;
  userEmail: string;
  amount: number;
  status: string; // PAID, PENDING, FAILED, EXPIRED
  method: string; // STRIPE, CASH
  reference: string; // Stripe ID or Ticket ID
  description: string;
  date: Date;
  expiryDate?: Date;
};

export async function getAllPayments() {
  const session = await getServerSession(adminAuthOptions);
  if (!session) throw new Error("Unauthorized");

  const [subscriptions, registrations] = await Promise.all([
    prisma.subscription.findMany({
      include: {
        user: { select: { name: true, email: true } },
        plan: { select: { name: true, price: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.registration.findMany({
      include: {
        event: { select: { title: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const now = new Date();

  const subPayments: PaymentRecord[] = subscriptions.map(sub => {
    let status = sub.paymentStatus;
    // If pending and older than 24h, consider it expired (Stripe sessions usually expire in 24h)
    const isStripePending = sub.paymentMethod === "STRIPE" && sub.paymentStatus === "PENDING";
    const isOld = isAfter(now, addHours(sub.createdAt, 24));
    
    if (isStripePending && isOld) {
      status = "EXPIRED";
    }

    return {
      id: sub.id,
      type: "MEMBERSHIP",
      userName: sub.user.name || "Anonymous",
      userEmail: sub.user.email || "No Email",
      amount: sub.plan.price,
      status: status,
      method: sub.paymentMethod,
      reference: sub.stripeId || "CASH",
      description: `Membership: ${sub.plan.name}`,
      date: sub.createdAt,
      expiryDate: sub.endDate
    };
  });

  const regPayments: PaymentRecord[] = registrations.map(reg => {
    let status = reg.paymentStatus;
    const isStripePending = reg.paymentMethod === "STRIPE" && reg.paymentStatus === "PENDING";
    const isOld = isAfter(now, addHours(reg.createdAt, 24));

    if (isStripePending && isOld) {
      status = "EXPIRED";
    }

    return {
      id: reg.id,
      type: "EVENT",
      userName: reg.name,
      userEmail: reg.email,
      amount: reg.pricePaid || 0,
      status: status,
      method: reg.paymentMethod,
      reference: reg.stripeId || reg.ticketId,
      description: `Event: ${reg.event.title}`,
      date: reg.createdAt,
      // For events, we don't have a specific subscription-style expiry, 
      // but the registration itself could be considered expired if not paid.
    };
  });

  // Combine and sort by date descending
  return [...subPayments, ...regPayments].sort((a, b) => b.date.getTime() - a.date.getTime());
}
