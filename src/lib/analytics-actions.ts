"use server";

import { prisma } from "./prisma";
import { getServerSession } from "next-auth";
import { requireAdmin } from "./guards";
import { startOfMonth, endOfMonth, subMonths, format, startOfDay } from "date-fns";

export async function getAnalyticsData() {
  await requireAdmin();

  // 1. KPI Aggregations
  const [
    totalRevenueData,
    activeSubscriptions,
    totalRegistrations,
    totalMembers,
    recentActivity
  ] = await Promise.all([
    prisma.registration.aggregate({
      _sum: { pricePaid: true },
      where: { paymentStatus: "PAID" }
    }),
    // `status: ACTIVE` alone is not enough: nothing sweeps the database when a
    // term lapses now that there is no gateway sending subscription events, so
    // the end date is what decides whether a membership is still running.
    prisma.subscription.count({
      where: { status: "ACTIVE", endDate: { gte: new Date() } }
    }),
    prisma.registration.count(),
    prisma.user.count({
      where: { role: "MEMBER" }
    }),
    fetchRecentActivity()
  ]);

  // Calculate membership revenue by fetching all paid subscriptions and summing their plan prices.
  // Subscription model itself doesn't store the price Paid (it's linked to MembershipPlan).
  const paidSubscriptions = await prisma.subscription.findMany({
    where: { paymentStatus: "PAID" },
    include: { plan: true }
  });
  const subRevenue = paidSubscriptions.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);

  const totalRevenue = (totalRevenueData._sum.pricePaid || 0) + subRevenue;

  // 2. Growth Trends (Last 6 Months)
  const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), i)).reverse();
  const growthTrends = await Promise.all(
    months.map(async (date) => {
      const start = startOfMonth(date);
      const end = endOfMonth(date);

      const regCount = await prisma.registration.count({
        where: { createdAt: { gte: start, lte: end } }
      });

      const regRev = await prisma.registration.aggregate({
        _sum: { pricePaid: true },
        where: { 
          createdAt: { gte: start, lte: end },
          paymentStatus: "PAID"
        }
      });

      const subRevData = await prisma.subscription.findMany({
        where: { 
          createdAt: { gte: start, lte: end },
          paymentStatus: "PAID"
        },
        include: { plan: true }
      });
      const subRev = subRevData.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);

      return {
        month: format(date, "MMM"),
        registrations: regCount,
        revenue: (regRev._sum.pricePaid || 0) + subRev,
      };
    })
  );

  // 3. Membership Distribution
  const plans = await prisma.membershipPlan.findMany({
    include: {
      _count: {
        select: {
          subscriptions: { where: { status: "ACTIVE", endDate: { gte: new Date() } } }
        }
      }
    }
  });

  const membershipDistribution = plans.map(plan => ({
    name: plan.name,
    value: plan._count.subscriptions
  }));

  // 4. Event Performance
  const recentEvents = await prisma.event.findMany({
    take: 5,
    orderBy: { date: "desc" },
    include: {
      _count: { select: { registrations: true } },
      registrations: { where: { isCheckedIn: true } }
    }
  });

  const eventPerformance = recentEvents.map(event => ({
    name: event.title.length > 15 ? event.title.substring(0, 12) + "..." : event.title,
    registrations: event._count.registrations,
    attendance: event.registrations.length,
  }));

  // 5. Month-on-month change for each KPI.
  //
  // These were four hardcoded strings ("+12.5%", "+3.2%", "+8.4%", "+2.1%") —
  // two here and two inline in the page — so the cards showed the same growth
  // on launch day as a year later, and would have claimed growth while revenue
  // fell. Each card displays an all-time total, so the honest comparison is
  // that same total as it stood a month ago.
  const monthAgo = subMonths(new Date(), 1);

  const [
    priorRegRevenue,
    priorPaidSubs,
    priorRegistrations,
    priorActiveMembers,
    priorUsers,
  ] = await Promise.all([
    prisma.registration.aggregate({
      _sum: { pricePaid: true },
      where: { paymentStatus: "PAID", createdAt: { lt: monthAgo } },
    }),
    prisma.subscription.findMany({
      where: { paymentStatus: "PAID", createdAt: { lt: monthAgo } },
      include: { plan: true },
    }),
    prisma.registration.count({ where: { createdAt: { lt: monthAgo } } }),
    // "Active a month ago" means the term had started and had not yet ended at
    // that point — not simply that the row is ACTIVE today.
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
        startDate: { lte: monthAgo },
        endDate: { gte: monthAgo },
      },
    }),
    prisma.user.count({ where: { role: "MEMBER", createdAt: { lt: monthAgo } } }),
  ]);

  const priorRevenue =
    (priorRegRevenue._sum.pricePaid || 0) +
    priorPaidSubs.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);

  return {
    kpis: {
      totalRevenue,
      activeMembers: activeSubscriptions,
      totalRegistrations,
      totalUsers: totalMembers,
      revenueChange: percentChange(totalRevenue, priorRevenue),
      membersChange: percentChange(activeSubscriptions, priorActiveMembers),
      registrationsChange: percentChange(totalRegistrations, priorRegistrations),
      usersChange: percentChange(totalMembers, priorUsers),
    },
    growthTrends,
    membershipDistribution,
    eventPerformance,
    recentActivity
  };
}

/**
 * Percentage change from `previous` to `current`.
 *
 * Returns null when there is nothing to compare against — a first month, or a
 * metric that was zero. Growing from 0 to 5 is not "+500%", and printing
 * "+0.0%" next to a real number reads as a measurement rather than an absence.
 * The card hides the delta entirely in that case.
 */
function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

async function fetchRecentActivity() {
  const [registrations, subscriptions, contributions] = await Promise.all([
    prisma.registration.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { event: true }
    }),
    prisma.subscription.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: true, plan: true }
    }),
    prisma.mediaContribution.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: true }
    })
  ]);

  const activities = [
    ...registrations.map(r => ({
      id: r.id,
      type: "registration",
      title: "New Registration",
      description: `${r.name} registered for ${r.event.title}`,
      time: r.createdAt,
      icon: "User"
    })),
    ...subscriptions.map(s => ({
      id: s.id,
      type: "subscription",
      title: "New Membership",
      description: `${s.user?.name || "A user"} subscribed to ${s.plan.name}`,
      time: s.createdAt,
      icon: "CreditCard"
    })),
    ...contributions.map(c => ({
      id: c.id,
      type: "contribution",
      title: "Media Contribution",
      description: `${c.user?.name || "A user"} uploaded a new photo`,
      time: c.createdAt,
      icon: "Image"
    }))
  ];

  return activities.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 8);
}
