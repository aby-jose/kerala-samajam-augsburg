"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Calendar,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { getAdminDashboardStats } from "@/lib/event-actions";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatCard } from "@/components/admin/ui/stat-card";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { cardSurface, panelHeader } from "@/components/admin/ui/surface";
import { cn } from "@/lib/utils";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getAdminDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const statCards = [
    {
      label: "Total registrations",
      value: stats.totalRegistrations.toString(),
      icon: Users,
      tone: "primary" as const,
      delta: stats.regTrend,
      hint: "vs. last month",
    },
    {
      label: "Upcoming events",
      value: stats.upcomingEvents.toString(),
      icon: Calendar,
      tone: "violet" as const,
      hint: "currently scheduled",
    },
    {
      label: "Check-ins",
      value: stats.checkedInCount.toString(),
      icon: CheckCircle2,
      tone: "emerald" as const,
      hint: "updated in real time",
    },
    {
      label: "Estimated revenue",
      value: `€${stats.totalRevenue.toLocaleString()}`,
      icon: TrendingUp,
      tone: "amber" as const,
      delta: stats.revTrend,
      hint: "vs. last month",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of registrations, events and revenue."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            tone={stat.tone}
            delta={stat.delta}
            hint={stat.hint}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent registrations */}
        <section className={cardSurface}>
          <header className={panelHeader}>
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground">Recent registrations</h2>
              <p className="text-xs text-muted-foreground">Latest sign-ups across all events</p>
            </div>
            <Link
              href="/admin/registrations"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          <div className="divide-y divide-border">
            {stats.recentRegistrations.map((reg: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-xs font-semibold text-primary">
                    {reg.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{reg.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{reg.event?.title}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(reg.createdAt), { addSuffix: true })}
                </span>
              </div>
            ))}
            {stats.recentRegistrations.length === 0 && (
              <EmptyState
                icon={Users}
                title="No registrations yet"
                description="New event sign-ups will appear here."
                className="py-10"
              />
            )}
          </div>
        </section>

        {/* Event engagement */}
        <section className={cardSurface}>
          <header className={panelHeader}>
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground">Event capacity</h2>
              <p className="text-xs text-muted-foreground">Registrations against capacity per event</p>
            </div>
          </header>
          <div className="space-y-5 px-5 py-5 sm:px-6">
            {stats.eventStatus.map((event: any, idx: number) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="truncate font-medium text-foreground">{event.title}</span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{event.status}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-primary/70 to-primary transition-all duration-500"
                    style={{ width: `${event.progress}%` }}
                  />
                </div>
              </div>
            ))}
            {stats.eventStatus.length === 0 && (
              <EmptyState
                icon={Calendar}
                title="No active events"
                description="Create an event to start tracking engagement."
                tone="violet"
                className="py-6"
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(cardSurface, "p-5")}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className={cn(cardSurface, "p-5")}>
            <Skeleton className="h-4 w-40" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
