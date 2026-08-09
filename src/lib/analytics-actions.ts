"use server";

import { prisma } from "./prisma";
import { getServerSession } from "next-auth";
import { adminAuthOptions } from "./auth";
import { startOfMonth, endOfMonth, subMonths, format, startOfDay } from "date-fns";

export async function getAnalyticsData() {
  const session = await getServerSession(adminAuthOptions);
  if (!session || (session.user as any)?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

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
    prisma.subscription.count({
      where: { status: "ACTIVE" }
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
        select: { subscriptions: { where: { status: "ACTIVE" } } }
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

  return {
    kpis: {
      totalRevenue,
      activeMembers: activeSubscriptions,
      totalRegistrations,
      totalUsers: totalMembers,
      revenueChange: "+12.5%", // Mocked for now
      membersChange: "+3.2%",  // Mocked for now
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
