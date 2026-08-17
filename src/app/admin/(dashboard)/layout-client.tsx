"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Calendar,
  Image as ImageIcon,
  Settings,
  LogOut,
  LayoutDashboard,
  Users,
  CreditCard,
  ShieldCheck,
  Wallet,
  Sparkles,
  ClipboardList,
  FileClock,
  Mail,
  Scale,
  FileCheck,
  FileText,
  Menu,
  Send,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import NextTopLoader from "nextjs-toploader";

import type { Permission } from "@/lib/permissions";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { useConfig } from "@/components/providers/config-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminLayoutClient({
  children,
  allowedPermissions,
}: {
  children: React.ReactNode;
  allowedPermissions: Permission[];
}) {
  return (
    <ConfirmDialogProvider>
      <NextTopLoader color="hsl(var(--primary))" showSpinner={false} height={2} />
      <AdminContent allowedPermissions={allowedPermissions}>{children}</AdminContent>
    </ConfirmDialogProvider>
  );
}

const NAV_GROUPS: {
  label: string;
  items: {
    href: string;
    label: string;
    icon: React.ElementType;
    permission: Permission;
    isActive: (pathname: string) => boolean;
  }[];
}[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view", isActive: (p) => p === "/admin/dashboard" },
      { href: "/admin/events", label: "Events", icon: Calendar, permission: "events.view", isActive: (p) => p.startsWith("/admin/events") },
      { href: "/admin/registrations", label: "Registrations", icon: Users, permission: "registrations.view", isActive: (p) => p.startsWith("/admin/registrations") },
      { href: "/admin/payments", label: "Payments", icon: Wallet, permission: "payments.view", isActive: (p) => p.startsWith("/admin/payments") },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/admin/members", label: "Members", icon: Users, permission: "members.view", isActive: (p) => p === "/admin/members" || p.startsWith("/admin/members/") },
      {
        href: "/admin/membership",
        label: "Plans",
        icon: CreditCard,
        permission: "membership.plans.view",
        isActive: (p) => p.startsWith("/admin/membership") && !p.includes("/applications"),
      },
      {
        href: "/admin/membership/applications",
        label: "Applications",
        icon: ClipboardList,
        permission: "membership.applications.view",
        isActive: (p) => p === "/admin/membership/applications",
      },
      { href: "/admin/inquiries", label: "Inquiries", icon: Mail, permission: "inquiries.view", isActive: (p) => p.startsWith("/admin/inquiries") },
      { href: "/admin/leadership", label: "Leadership", icon: ShieldCheck, permission: "content.leadership.edit", isActive: (p) => p.startsWith("/admin/leadership") },
      { href: "/admin/about", label: "About Page", icon: FileText, permission: "content.about.edit", isActive: (p) => p.startsWith("/admin/about") },
    ],
  },
  {
    label: "Media",
    items: [
      {
        href: "/admin/gallery",
        label: "Gallery",
        icon: ImageIcon,
        permission: "gallery.view",
        isActive: (p) => p.startsWith("/admin/gallery") && !p.includes("/contributions"),
      },
      {
        href: "/admin/gallery/contributions",
        label: "Contributions",
        icon: Sparkles,
        permission: "gallery.contributions.view",
        isActive: (p) => p.startsWith("/admin/gallery/contributions"),
      },
    ],
  },
  {
    label: "Legal",
    items: [
      {
        href: "/admin/legal",
        label: "Documents",
        icon: Scale,
        permission: "legal.view",
        isActive: (p) => p.startsWith("/admin/legal") && !p.includes("/consents"),
      },
      {
        href: "/admin/legal/consents",
        label: "Consents",
        icon: FileCheck,
        permission: "legal.consents.view",
        isActive: (p) => p.startsWith("/admin/legal/consents"),
      },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "analytics.view", isActive: (p) => p === "/admin/analytics" },
      { href: "/admin/emails", label: "Email", icon: Send, permission: "email.view", isActive: (p) => p.startsWith("/admin/emails") },
      { href: "/admin/staff", label: "Team", icon: Users, permission: "staff.view", isActive: (p) => p.startsWith("/admin/staff") },
      { href: "/admin/roles", label: "Roles", icon: ShieldCheck, permission: "roles.view", isActive: (p) => p.startsWith("/admin/roles") },
      { href: "/admin/audit", label: "Audit log", icon: FileClock, permission: "audit.view", isActive: (p) => p.startsWith("/admin/audit") },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.edit", isActive: (p) => p === "/admin/settings" },
    ],
  },
];

// Sidebar, topbar and the main panel stay plain black/white — no color
// tint. The canvas behind them is a plain neutral gray, distinct in both
// themes, so the panel still reads as sitting "on" something.
const PANEL_BG = "bg-white dark:bg-black";
const CANVAS_BG = "bg-[#F0F0F0] dark:bg-[#121212]";

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  events: "Events",
  registrations: "Registrations",
  payments: "Payments",
  members: "Members",
  membership: "Membership",
  applications: "Applications",
  inquiries: "Inquiries",
  leadership: "Leadership",
  gallery: "Gallery",
  contributions: "Contributions",
  analytics: "Analytics",
  audit: "Audit log",
  emails: "Email",
  preview: "Template gallery",
  roles: "Roles",
  settings: "Settings",
  staff: "Team",
  "check-in": "Check-in",
  legal: "Legal",
  consents: "Consents",
  imprint: "Imprint",
  privacy: "Privacy Policy",
  terms: "Terms of Use",
  withdrawal: "Right of Withdrawal",
  cookies: "Cookie Policy",
  accessibility: "Accessibility",
};

function AdminContent({
  children,
  allowedPermissions,
}: {
  children: React.ReactNode;
  allowedPermissions: Permission[];
}) {
  const config = useConfig();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  // Close the mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async (e?: React.MouseEvent | Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      // Manual signout to ensure we hit the correct admin auth endpoint
      // and bypass any nested SessionProvider context issues.
      const csrfRes = await fetch("/api/admin/auth/csrf");
      const { csrfToken } = await csrfRes.json();

      await fetch("/api/admin/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          csrfToken,
          callbackUrl: "/admin/login",
          json: "true",
        }),
      });

      // Force a hard redirect and replace history entry
      window.location.replace("/admin/login?logout=true");
    } catch (error) {
      console.error("Logout error:", error);
      window.location.replace("/admin/login?logout=true");
    }
  };

  if (status === "loading") {
    return (
      <div className={cn("flex min-h-screen items-center justify-center", CANVAS_BG)}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return null;

  // Nav filtering is cosmetic only — every admin page still enforces its own
  // permission via `requirePermissionPage`. A group whose items are all
  // hidden disappears entirely, heading included.
  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowedPermissions.includes(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  const crumbs = pathname
    .split("/")
    .filter((segment) => BREADCRUMB_LABELS[segment])
    .map((segment) => BREADCRUMB_LABELS[segment]);

  const userName = session.user?.name || "Administrator";
  const userEmail = session.user?.email || "";
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sidebarBody = (
    <>
      <div className="relative flex shrink-0 flex-col items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/[0.08]">
          <img
            src={config.branding.logoUrl || "/images/logo.png"}
            alt={config.siteName}
            className="h-full w-full object-contain"
          />
        </div>
        {!isCollapsed && (
          <div className="w-full text-center">
            <p className="font-sans text-[13px] font-semibold leading-snug text-foreground">
              {config.siteName}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Admin Panel</p>
          </div>
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.04] hover:text-foreground md:hidden dark:hover:bg-white/[0.06]"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            {!isCollapsed && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={item.isActive(pathname)}
                  isCollapsed={isCollapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div className={cn("admin-shell flex h-screen overflow-hidden", CANVAS_BG)}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "z-40 hidden h-full shrink-0 flex-col transition-[width] duration-200 md:flex",
          PANEL_BG,
          "shadow-[4px_0_24px_-8px_rgba(0,0,0,0.06)]",
          isCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className={cn("absolute inset-y-0 left-0 flex w-72 flex-col shadow-2xl animate-in slide-in-from-left duration-200", PANEL_BG)}>
            {sidebarBody}
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className={cn("z-30 flex h-[72px] shrink-0 items-center gap-3 px-4 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] md:px-8 xl:px-10", PANEL_BG)}>
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.04] hover:text-foreground md:hidden dark:hover:bg-white/[0.06]"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "hidden h-9 w-9 items-center justify-center rounded-lg border transition-colors md:flex",
              "border-black/[0.07] bg-black/[0.02] text-muted-foreground hover:bg-black/[0.05] hover:text-foreground",
              "dark:border-white/[0.10] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          <nav className="flex min-w-0 items-center gap-1.5" aria-label="Breadcrumb">
            <span className="hidden text-sm text-muted-foreground sm:inline">Admin</span>
            {crumbs.map((crumb, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/40 sm:block" />
                <span
                  className={cn(
                    "truncate",
                    i === crumbs.length - 1
                      ? "font-sans text-[15px] font-bold tracking-tight text-foreground"
                      : "hidden text-sm text-muted-foreground sm:inline"
                  )}
                >
                  {crumb}
                </span>
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/60 text-xs font-bold text-primary-foreground shadow-sm shadow-primary/40 ring-2 ring-transparent transition-all hover:ring-primary/40"
                  aria-label="Account menu"
                >
                  {initials || "A"}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-black" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5">
                <div className="flex items-center gap-3 rounded-xl p-2.5">
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/60 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/40">
                    {initials || "A"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
                    {userEmail && <p className="truncate text-xs text-muted-foreground">{userEmail}</p>}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => handleLogout(e as Event)}
                  className="rounded-lg text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden p-3 pb-4 sm:p-4 sm:pb-6 md:p-6 md:pb-8">
          <div className="h-full w-full">
            <div
              className={cn(
                "h-full overflow-y-auto rounded-3xl p-4 pb-6 sm:p-6 sm:pb-8 md:p-8 md:pb-10",
                PANEL_BG,
                "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-28px_rgba(0,0,0,0.14)]"
              )}
            >
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  isCollapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  isCollapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all",
        active
          ? "bg-linear-to-b from-primary to-primary/90 text-primary-foreground shadow-sm shadow-primary/30"
          : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]",
        isCollapsed && "justify-center px-0"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "drop-shadow-sm")} />
      {!isCollapsed && <span className="truncate">{label}</span>}
      {isCollapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {label}
        </span>
      )}
    </Link>
  );
}
