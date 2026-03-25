import { cn } from "@/lib/utils";
import Link from "next/link";
import { 
  BarChart3, 
  Calendar, 
  Image as ImageIcon, 
  Settings, 
  LogOut,
  LayoutDashboard
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Mini Sidebar */}
      <aside className="w-20 md:w-64 border-r border-border/40 flex flex-col bg-secondary/10 backdrop-blur-xl">
        <div className="p-6 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">KSA</span>
          </div>
          <span className="font-bold hidden md:block tracking-tight">Admin Portal</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 py-4">
          <AdminNavLink href="/admin" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
          <AdminNavLink href="/admin/events" icon={<Calendar className="w-5 h-5" />} label="Events" />
          <AdminNavLink href="/admin/gallery" icon={<ImageIcon className="w-5 h-5" />} label="Gallery" />
          <AdminNavLink href="#analytics" icon={<BarChart3 className="w-5 h-5" />} label="Analytics" disabled />
          <AdminNavLink href="#settings" icon={<Settings className="w-5 h-5" />} label="Settings" disabled />
        </nav>

        <div className="p-4 border-t border-border/40 space-y-4">
          <div className="flex justify-center md:justify-start">
             <ThemeToggle />
          </div>
          <AdminNavLink href="/" icon={<LogOut className="w-5 h-5" />} label="Logout" className="text-destructive hover:bg-destructive/10" />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 border-b border-border/40 flex items-center justify-between px-8 bg-background/50 backdrop-blur-md sticky top-0 z-50">
           <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Management Console</h1>
           <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center border border-border/40">
                 <span className="text-[10px] font-bold">AJ</span>
              </div>
           </div>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function AdminNavLink({ href, icon, label, className, disabled }: { href: string; icon: React.ReactNode; label: string; className?: string; disabled?: boolean }) {
  return (
    <Link 
      href={disabled ? "#" : href} 
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-secondary",
        className
      )}
    >
      <div className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
        {icon}
      </div>
      <span className="text-sm font-medium hidden md:block text-muted-foreground group-hover:text-foreground">
        {label}
      </span>
    </Link>
  );
}
