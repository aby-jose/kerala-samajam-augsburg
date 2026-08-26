"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Calendar,
  CheckCircle2,
  Wallet,
  ArrowRight,
  ChevronRight,
  CreditCard,
  UserCheck,
  Mail,
  Image as ImageIcon,
  MapPin,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";
import { getAdminDashboardStats } from "@/lib/event-actions";
import { formatDistanceToNow, format, differenceInCalendarDays } from "date-fns";
import { formatDelta } from "@/lib/format-stats";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatCard } from "@/components/admin/ui/stat-card";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { cardSurface, panelHeader, chipTone, type ChipTone } from "@/components/admin/ui/surface";
import { cn } from "@/lib/utils";

const ATTENTION_ICON: Record<string, React.ElementType> = {
  payments: CreditCard,
  membership: UserCheck,
  inquiries: Mail,
  contributions: ImageIcon,
};

const PAYMENT_STATUS_TONE: Record<string, ChipTone> = {
  PAID: "emerald",
  PENDING: "amber",
};

export default function DashboardClient() {
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

  const totalAttention = stats.attention.reduce((acc: number, item: any) => acc + item.count, 0);

  const statCards = [
    stats.canViewRegistrations && {
      label: "Total registrations",
      value: stats.totalRegistrations.toString(),
      icon: Users,
      tone: "primary" as const,
      delta: formatDelta(stats.regTrend),
      deltaDirection: stats.regTrend != null && stats.regTrend < 0 ? "down" as const : "up" as const,
      hint: stats.regTrend == null ? "no prior month to compare" : "vs. last month",
    },
    stats.canViewPayments && {
      label: "Revenue collected",
      value: `€${stats.totalRevenue.toLocaleString()}`,
      icon: Wallet,
      tone: "amber" as const,
      delta: formatDelta(stats.revTrend),
      deltaDirection: stats.revTrend != null && stats.revTrend < 0 ? "down" as const : "up" as const,
      hint: stats.revTrend == null ? "no prior month to compare" : "vs. last month",
    },
    stats.canViewEvents && {
      label: "Upcoming events",
      value: stats.upcomingEvents.toString(),
      icon: Calendar,
      tone: "violet" as const,
      hint: "currently scheduled",
    },
    stats.canViewRegistrations && {
      label: "Check-ins",
      value: stats.checkedInCount.toString(),
      icon: CheckCircle2,
      tone: "emerald" as const,
      hint: stats.checkInRate == null ? "no registrations yet" : `${stats.checkInRate}% of registrations`,
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    icon: LucideIcon;
    tone: "primary" | "amber" | "violet" | "emerald";
    delta?: string;
    deltaDirection?: "up" | "down";
    hint: string;
  }>;

  const hasAnySection = statCards.length > 0 || stats.canViewAttention || stats.canViewEvents || stats.canViewRegistrations;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of registrations, events and what needs your attention."
      />

      {!hasAnySection && (
        <div className={cardSurface}>
          <EmptyState
            icon={PartyPopper}
            title="Nothing to show here"
            description="Your role doesn't include any dashboard widgets yet."
            className="py-10"
          />
        </div>
      )}

      {statCards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              tone={stat.tone}
              delta={stat.delta}
              deltaDirection={stat.deltaDirection}
              hint={stat.hint}
            />
          ))}
        </div>
      )}

      <div className={cn("grid grid-cols-1 gap-5", stats.canViewAttention && stats.canViewEvents && "lg:grid-cols-2")}>
        {/* Needs attention */}
        {stats.canViewAttention && (
        <section className={cardSurface}>
          <header className={panelHeader}>
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground">Needs attention</h2>
              <p className="text-xs text-muted-foreground">Items waiting on an admin action</p>
            </div>
            {totalAttention > 0 && (
              <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                {totalAttention}
              </span>
            )}
          </header>
          {totalAttention === 0 ? (
            <EmptyState
              icon={PartyPopper}
              title="All caught up"
              description="Nothing needs your attention right now."
              tone="emerald"
              className="py-10"
            />
          ) : (
            <div className="divide-y divide-border">
              {stats.attention.map((item: any) => {
                const Icon = ATTENTION_ICON[item.key] ?? Users;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3.5 transition-colors sm:px-6",
                      item.count > 0 ? "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]" : "opacity-60"
                    )}
                  >
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", chipTone(item.count > 0 ? item.tone : "neutral"))}>
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                    </div>
                    {item.count > 0 ? (
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", chipTone(item.tone))}>
                        {item.count}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">None</span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        )}

        {/* Upcoming events */}
        {stats.canViewEvents && (
        <section className={cardSurface}>
          <header className={panelHeader}>
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground">Upcoming events</h2>
              <p className="text-xs text-muted-foreground">
                {stats.canViewRegistrations ? "Next on the calendar, with registrations against capacity" : "Next on the calendar"}
              </p>
            </div>
            <Link
              href="/admin/events"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          <div className="divide-y divide-border">
            {stats.upcomingEventsList.map((event: any) => {
              const daysUntil = differenceInCalendarDays(new Date(event.date), new Date());
              const progress = event.maxAttendees
                ? Math.min(Math.round((event.registrations / event.maxAttendees) * 100), 100)
                : null;
              return (
                <Link
                  key={event.id}
                  href={`/admin/registrations?event=${event.id}`}
                  className="block px-5 py-3.5 transition-colors hover:bg-black/[0.03] sm:px-6 dark:hover:bg-white/[0.04]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      <span className="text-[10px] font-semibold uppercase leading-none">{format(new Date(event.date), "MMM")}</span>
                      <span className="text-sm font-bold leading-tight tabular-nums">{format(new Date(event.date), "d")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                        </span>
                      </div>
                      {event.location && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {event.location}
                        </p>
                      )}
                      {event.registrations != null && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-linear-to-r from-primary/70 to-primary transition-all duration-500"
                              style={{ width: `${progress ?? 0}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {event.registrations}{event.maxAttendees ? `/${event.maxAttendees}` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
            {stats.upcomingEventsList.length === 0 && (
              <EmptyState
                icon={Calendar}
                title="No upcoming events"
                description="Create an event to start tracking registrations."
                tone="violet"
                className="py-10"
              />
            )}
          </div>
        </section>
        )}
      </div>

      {/* Recent registrations */}
      {stats.canViewRegistrations && (
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
              <div className="flex shrink-0 items-center gap-3">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", chipTone(PAYMENT_STATUS_TONE[reg.paymentStatus] ?? "neutral"))}>
                  {reg.paymentStatus === "PAID" ? "Paid" : "Pending"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(reg.createdAt), { addSuffix: true })}
                </span>
              </div>
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
      )}
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
      <div className={cn(cardSurface, "p-5")}>
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, j) => (
            <Skeleton key={j} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
