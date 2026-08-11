"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  Users,
  CreditCard,
  Calendar,
  Activity,
  Image as ImageIcon,
  User,
  RefreshCcw,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAnalyticsData } from "@/lib/analytics-actions";
import { format } from "date-fns";
import { cn, exportToCSV } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatCard } from "@/components/admin/ui/stat-card";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { cardSurface, panelHeader, chipTone, type ChipTone } from "@/components/admin/ui/surface";

const COLORS = ["#e11d48", "#4f46e5", "#10b981", "#f59e0b", "#8b5cf6"];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  fontSize: "12px",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
};

const axisTick = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };

/**
 * Render a month-on-month change, or nothing when there is no baseline.
 *
 * `null` means the metric was zero a month ago — a first month, or the first
 * paid registration. Showing "+100%" or "+0.0%" there would present the
 * absence of a comparison as a measurement.
 */
function formatDelta(change: number | null | undefined): string | undefined {
  if (change == null || !Number.isFinite(change)) return undefined;
  const rounded = Math.round(change * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const result = await getAnalyticsData();
      setData(result);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExport = () => {
    if (!data) return;

    // Export KPIs and Growth Trends
    const headers = ["Metric", "Value", "Trend"];
    const kpiData = [
      ["Total Revenue", `€${data.kpis.totalRevenue}`, formatDelta(data.kpis.revenueChange) ?? "n/a"],
      ["Active Members", data.kpis.activeMembers, formatDelta(data.kpis.membersChange) ?? "n/a"],
      ["Total Registrations", data.kpis.totalRegistrations, formatDelta(data.kpis.registrationsChange) ?? "n/a"],
      ["Total Users", data.kpis.totalUsers, formatDelta(data.kpis.usersChange) ?? "n/a"],
    ];

    const growthHeaders = ["Month", "Registrations", "Revenue (€)"];
    const growthData = data.growthTrends.map((t: any) => [t.month, t.registrations, t.revenue]);

    // We combine them or export separately. Let's export growth data as it's more tabular.
    exportToCSV(growthHeaders, growthData, "analytics-growth-report");
  };

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  const kpiCards = [
    {
      title: "Total revenue",
      value: `€${data.kpis.totalRevenue.toLocaleString()}`,
      change: data.kpis.revenueChange,
      icon: CreditCard,
      tone: "amber" as const,
    },
    {
      title: "Active members",
      value: data.kpis.activeMembers.toLocaleString(),
      change: data.kpis.membersChange,
      icon: Users,
      tone: "blue" as const,
    },
    {
      title: "Event registrations",
      value: data.kpis.totalRegistrations.toLocaleString(),
      change: data.kpis.registrationsChange,
      icon: Calendar,
      tone: "primary" as const,
    },
    {
      title: "Community reach",
      value: data.kpis.totalUsers.toLocaleString(),
      change: data.kpis.usersChange,
      icon: Activity,
      tone: "violet" as const,
    }
  ];

  const activityTone: Record<string, ChipTone> = {
    User: "blue",
    CreditCard: "emerald",
    Image: "violet",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Growth, revenue and engagement across the community."
      >
        <Button
          variant="outline"
          onClick={fetchData}
          disabled={isRefreshing}
          className="h-9 rounded-lg"
        >
          <RefreshCcw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
        <Button onClick={handleExport} className="h-9 rounded-lg">
          <Download className="mr-2 h-4 w-4" />
          Export report
        </Button>
      </PageHeader>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <StatCard
            key={kpi.title}
            label={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            tone={kpi.tone}
            delta={formatDelta(kpi.change)}
            // Was hardcoded "up", so a decline still showed a rising arrow.
            deltaDirection={kpi.change != null && kpi.change < 0 ? "down" : "up"}
            hint={kpi.change == null ? "no prior month to compare" : "vs. last month"}
          />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue & Registration Growth */}
        <section className={cn(cardSurface, "lg:col-span-2")}>
          <header className={panelHeader}>
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground">Growth trends</h2>
              <p className="text-xs text-muted-foreground">Monthly registration and revenue overview for the last 6 months.</p>
            </div>
          </header>
          <div className="p-5">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.growthTrends}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={axisTick}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={axisTick}
                    tickFormatter={(value) => `€${value}`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#e11d48"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="registrations"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fill="transparent"
                    name="Registrations"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Membership Distribution */}
        <section className={cardSurface}>
          <header className={panelHeader}>
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground">Membership mix</h2>
              <p className="text-xs text-muted-foreground">Active subscriptions by plan type.</p>
            </div>
          </header>
          <div className="p-5">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.membershipDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.membershipDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid w-full grid-cols-2 gap-x-4 gap-y-2">
              {data.membershipDistribution.map((item: any, i: number) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate text-xs text-muted-foreground">{item.name}</span>
                  <span className="ml-auto text-xs font-medium text-foreground tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Event Performance */}
        <section className={cn(cardSurface, "lg:col-span-2")}>
          <header className={panelHeader}>
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground">Recent event attendance</h2>
              <p className="text-xs text-muted-foreground">Comparing tickets sold vs. actual check-ins.</p>
            </div>
          </header>
          <div className="p-5">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.eventPerformance} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="registrations" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Tickets Sold" />
                  <Bar dataKey="attendance" fill="#10b981" radius={[4, 4, 0, 0]} name="Checked In" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Recent Activity Feed */}
        <section className={cardSurface}>
          <header className={panelHeader}>
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground">Recent activity</h2>
              <p className="text-xs text-muted-foreground">Latest community actions and updates.</p>
            </div>
          </header>
          <div className="space-y-5 p-5">
            {data.recentActivity.map((activity: any) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", chipTone(activityTone[activity.icon] ?? "neutral"))}>
                  {activity.icon === "User" && <User className="h-4 w-4" />}
                  {activity.icon === "CreditCard" && <CreditCard className="h-4 w-4" />}
                  {activity.icon === "Image" && <ImageIcon className="h-4 w-4" />}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(activity.time), "MMM d, h:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(cardSurface, "p-5")}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-7 w-20" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={cn(cardSurface, "lg:col-span-2")}>
          <div className="border-b border-border px-5 py-4">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="p-5">
            <Skeleton className="h-[320px] w-full" />
          </div>
        </div>
        <div className={cardSurface}>
          <div className="border-b border-border px-5 py-4">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="p-5">
            <Skeleton className="h-[320px] w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
