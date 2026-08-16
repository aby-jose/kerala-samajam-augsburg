import { prisma } from "./prisma";

/**
 * Total money actually collected — paid event registrations plus paid
 * membership subscriptions — as of `before` (all-time when omitted).
 *
 * The dashboard and analytics page each used to total this differently (one
 * summed every `pricePaid` regardless of payment status and ignored
 * memberships, the other filtered to `PAID` and added subscriptions), so the
 * same "total revenue" figure disagreed between the two screens. Centralized
 * so both read the same number.
 */
export async function getCollectedRevenue(before?: Date): Promise<number> {
  const createdAt = before ? { lt: before } : undefined;

  const [regRevenue, paidSubscriptions] = await Promise.all([
    prisma.registration.aggregate({
      _sum: { pricePaid: true },
      where: { paymentStatus: "PAID", ...(createdAt && { createdAt }) },
    }),
    prisma.subscription.findMany({
      where: { paymentStatus: "PAID", ...(createdAt && { createdAt }) },
      include: { plan: true },
    }),
  ]);

  const subRevenue = paidSubscriptions.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);
  return (regRevenue._sum.pricePaid || 0) + subRevenue;
}
