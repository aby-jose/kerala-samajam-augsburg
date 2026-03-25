import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Atmosphere Background */}
      <div className="absolute inset-0 -z-10 bg-background">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[800px] max-h-[800px]">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute inset-0 bg-secondary/10 rounded-full blur-[80px] -translate-x-1/4 translate-y-1/4" />
        </div>
      </div>

      <header className="fixed top-0 w-full p-8 flex items-center justify-between z-50">
        <Link href="/" className="group flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center transition-transform group-hover:scale-110">
            <span className="text-white font-bold text-xs italic">KSA</span>
          </div>
          <span className="font-bold tracking-tight text-lg">Kerala Samajam Augsburg</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-6 mt-16">
        {children}
      </main>

      <footer className="p-8 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-muted-foreground/30">
          Kerala Samajam Augsburg — Est. 1995
        </p>
      </footer>
    </div>
  );
}
