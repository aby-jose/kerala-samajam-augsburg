"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Image as ImageIcon, 
  Settings, 
  ChevronRight,
  LogOut,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";

const sidebarItems = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Events", href: "/admin/events", icon: Calendar },
  { name: "Registrations", href: "/admin/registrations", icon: Users },
  { name: "Gallery", href: "/admin/gallery", icon: ImageIcon },
  { name: "Configuration", href: "/admin/config", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside className="w-64 bg-background border-r border-border/40 fixed inset-y-0 left-0 z-50 hidden lg:block">
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b border-border/40">
            <span className="text-xl font-bold text-primary">KSA Admin</span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {sidebarItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors group",
                  pathname.startsWith(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-primary"
                )}
              >
                <div className="flex items-center">
                  <item.icon className={cn("mr-3 h-4 w-4", pathname.startsWith(item.href) ? "" : "group-hover:text-primary")} />
                  {item.name}
                </div>
                {pathname.startsWith(item.href) && <ChevronRight className="h-4 w-4" />}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-border/40">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col">
        {/* Topbar */}
        <header className="h-16 bg-background border-b border-border/40 flex items-center justify-between px-6 sticky top-0 z-40">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {sidebarItems.find(item => pathname.startsWith(item.href))?.name || "Admin"}
          </h2>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
              AD
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
