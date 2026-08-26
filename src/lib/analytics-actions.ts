"use server";

import { prisma } from "./prisma";
import { getServerSession } from "next-auth";
import { requirePermission } from "./guards";
import { startOfMonth, endOfMonth, subMonths, format, startOfDay } from "date-fns";
import { getCollectedRevenue } from "./revenue";
import { percentChange } from "./format-stats";

export async function getAnalyticsData() {
  await requirePermission("analytics.view");

  // Every block below is independent of every other — none reads another
  // block's result — so they used to run as five sequential round trips
  // (each `await`ed before the next began) purely because they were written
  // as separate statements. Firing them all from one Promise.all lets the
  // database work them concurrently instead of paying for each stage's
  // latency back to back.
  const monthAgo = subMonths(new Date(), 1);
  const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), i)).reverse();

  const [
    // 1. KPI Aggregations
    totalRevenue,
    activeSubscriptions,
    totalRegistrations,
    totalMembers,
    recentActivity,
    // 2. Growth Trends (Last 6 Months)
    growthTrends,
    // 3. Membership Distribution
    plans,
    // 4. Event Performance
    recentEvents,
    // 5. Month-on-month change for each KPI.
    //
    // These were four hardcoded strings ("+12.5%", "+3.2%", "+8.4%", "+2.1%")
    // — two here and two inline in the page — so the cards showed the same
    // growth on launch day as a year later, and would have claimed growth
    // while revenue fell. Each card displays an all-time total, so the
    // honest comparison is that same total as it stood a month ago.
    priorRevenue,
    priorRegistrations,
    priorActiveMembers,
    priorUsers,
  ] = await Promise.all([
    getCollectedRevenue(),
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
    fetchRecentActivity(),
    Promise.all(
      months.map(async (date) => {
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const [regCount, regRev, subRevData] = await Promise.all([
          prisma.registration.count({
            where: { createdAt: { gte: start, lte: end } }
          }),
          prisma.registration.aggregate({
            _sum: { pricePaid: true },
            where: {
              createdAt: { gte: start, lte: end },
              paymentStatus: "PAID"
            }
          }),
          prisma.subscription.findMany({
            where: {
              createdAt: { gte: start, lte: end },
              paymentStatus: "PAID"
            },
            include: { plan: true }
          }),
        ]);
        const subRev = subRevData.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);

        return {
          month: format(date, "MMM"),
          registrations: regCount,
          revenue: (regRev._sum.pricePaid || 0) + subRev,
        };
      })
    ),
    prisma.membershipPlan.findMany({
      include: {
        _count: {
          select: {
            subscriptions: { where: { status: "ACTIVE", endDate: { gte: new Date() } } }
          }
        }
      }
    }),
    prisma.event.findMany({
      take: 5,
      orderBy: { date: "desc" },
      include: {
        _count: { select: { registrations: true } },
        registrations: { where: { isCheckedIn: true } }
      }
    }),
    getCollectedRevenue(monthAgo),
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

  const membershipDistribution = plans.map(plan => ({
    name: plan.name,
    value: plan._count.subscriptions
  }));

  const eventPerformance = recentEvents.map(event => ({
    name: event.title.length > 15 ? event.title.substring(0, 12) + "..." : event.title,
    registrations: event._count.registrations,
    attendance: event.registrations.length,
  }));

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
      include: { plan: true }
    }),
    prisma.mediaContribution.findMany({
      take: 5,
      orderBy: { createdAt: "desc" }
    })
  ]);

  // Subscription/MediaContribution -> User isn't a DB-enforced foreign key
  // (MongoDB), so `include: { user: true }` throws "Inconsistent query
  // result" the moment one row's user was ever removed directly in the
  // database rather than through the app. Look users up separately here so
  // one orphaned row can't take down the whole "Recent Activity" widget.
  const userIds = [...new Set([...subscriptions.map(s => s.userId), ...contributions.map(c => c.userId)])];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true }
  });
  const userNameById = new Map(users.map(u => [u.id, u.name]));

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
      description: `${userNameById.get(s.userId) || "A user"} subscribed to ${s.plan.name}`,
      time: s.createdAt,
      icon: "CreditCard"
    })),
    ...contributions.map(c => ({
      id: c.id,
      type: "contribution",
      title: "Media Contribution",
      description: `${userNameById.get(c.userId) || "A user"} uploaded a new photo`,
      time: c.createdAt,
      icon: "Image"
    }))
  ];

  return activities.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 8);
}
