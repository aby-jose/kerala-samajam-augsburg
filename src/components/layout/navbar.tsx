"use client";

import React, { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Calendar, Info, Home, Image as ImageIcon, Mail, Users, LogIn, User as UserIcon, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoginModal } from "../auth/login-modal";
import { useSession, signOut } from "next-auth/react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useConfig } from "../providers/config-provider";

const navItems = [
  { name: "Home", href: "/", icon: Home },
  { name: "About", href: "/about", icon: Info },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "Membership", href: "/membership", icon: Users, feature: "enableMembership" },
  { name: "Gallery", href: "/gallery", icon: ImageIcon, feature: "enableGallery" },
  { name: "Contact", href: "/contact", icon: Mail },
];

export interface NavbarProps {
  hideLinks?: boolean;
  forceLightText?: boolean;
}

function AuthQueryHandler({ onLoginRequested }: { onLoginRequested: () => void }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasOpenedRef = React.useRef(false);

  // Handle auto-opening login modal from query params
  React.useEffect(() => {
    const authParam = searchParams.get("auth");
    if (authParam === "login" && status === "unauthenticated" && !hasOpenedRef.current) {
      hasOpenedRef.current = true;
      onLoginRequested();
      // Clean up the URL synchronously using browser history API to prevent race conditions
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        params.delete("auth");
        const cleanSearch = params.toString();
        const newUrl = cleanSearch ? `${window.location.pathname}?${cleanSearch}` : window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
      // Also notify Next.js router to update its internal state
      const params = new URLSearchParams(searchParams.toString());
      params.delete("auth");
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, status, pathname, router, onLoginRequested]);

  // Reset the ref only when the parameter is cleared
  React.useEffect(() => {
    if (searchParams.get("auth") !== "login") {
      hasOpenedRef.current = false;
    }
  }, [searchParams]);

  return null;
}

export function Navbar({ hideLinks = false, forceLightText = false }: NavbarProps) {
  const config = useConfig();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  // A switched-off module's route 404s, so linking to it would just advertise
  // a dead end. This only tidies the menu — the enforcement is server-side in
  // `feature-gate.ts`, not here.
  const visibleNavItems = React.useMemo(
    () =>
      navItems.filter(
        (item) =>
          !item.feature ||
          config.features[item.feature as keyof typeof config.features]
      ),
    [config]
  );

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll(); // Check initial position for page refreshes
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  // Transparent on ALL pages until scroll, but force solid when mobile menu is open.
  const isSolid = scrolled || isOpen;

  // Pages that open on a dark section rather than a white one. The navbar sits
  // over them while it is still transparent, so its type has to invert until
  // the solid background takes over on scroll. `/events` itself is light — only
  // a single event page below it is dark.
  const hasDarkTop = isHomePage || /^\/events\/[^/]+$/.test(pathname) || /^\/gallery\/[^/]+$/.test(pathname);
  const useLightText = forceLightText || (hasDarkTop && !scrolled && !isOpen);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const siteWords = config.siteName.split(" ");
  const siteNameStart = siteWords.slice(0, -1).join(" ");
  const siteNameEnd = siteWords[siteWords.length - 1];

  return (
    <>
      <Suspense fallback={null}>
        <AuthQueryHandler onLoginRequested={() => setIsLoginModalOpen(true)} />
      </Suspense>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isSolid
            ? "bg-background/85 backdrop-blur-xl border-b border-border/60 shadow-[0_1px_20px_-8px_rgba(0,0,0,0.15)]"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-[72px] flex items-center justify-between gap-4">
          {/* Brand */}
          {/* Shrinkable rather than `shrink-0`: on a narrow phone the name
              ellipsises instead of pushing the actions off the screen. */}
          <Link href="/" className="flex items-center gap-2.5 min-w-0 transition-opacity hover:opacity-85">
            <Image
              src={config.branding.logoUrl || "/images/logo.png"}
              alt={config.siteName}
              width={40}
              height={40}
              priority
              className="h-9 lg:h-10 w-auto shrink-0"
            />
            <span
              className={cn(
                "truncate text-[13px] font-semibold tracking-tight transition-colors duration-300 sm:text-[15px] lg:text-base",
                useLightText ? "text-white" : "text-foreground"
              )}
            >
              {siteNameStart && <>{siteNameStart} </>}
              <span className="text-primary">{siteNameEnd}</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          {!hideLinks && (
            <nav
              className={cn(
                "hidden lg:flex items-center gap-0.5 p-1 rounded-full border transition-colors duration-300",
                useLightText
                  ? "bg-white/[0.08] border-white/15 backdrop-blur-md"
                  : "bg-muted/50 border-border/60"
              )}
            >
              {visibleNavItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200",
                      active
                        ? (useLightText ? "text-white" : "text-primary")
                        : (useLightText
                            ? "text-white/70 hover:text-white"
                            : "text-muted-foreground hover:text-foreground")
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="navbar-pill"
                        className={cn(
                          "absolute inset-0 rounded-full",
                          useLightText
                            ? "bg-white/15 border border-white/10"
                            : "bg-background shadow-sm border border-border/60"
                        )}
                        transition={{ type: "spring", stiffness: 350, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

            {/* Auth Section */}
            {status === "loading" ? (
              <div className="h-10 w-10 flex items-center justify-center">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : session ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-2.5 pl-1.5 pr-3 h-10 rounded-full border transition-all duration-200",
                      useLightText
                        ? "border-white/15 hover:bg-white/10"
                        : "border-border/60 hover:bg-muted"
                    )}
                  >
                    <div className="h-7 w-7 rounded-full overflow-hidden shrink-0">
                      {session.user?.image ? (
                        <img src={session.user.image} alt={session.user.name || ""} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-primary/15 flex items-center justify-center text-primary text-[11px] font-bold">
                          {session.user?.name?.substring(0, 1).toUpperCase() || "U"}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium truncate max-w-[110px] hidden sm:block",
                        useLightText ? "text-white" : "text-foreground"
                      )}
                    >
                      {session.user?.name?.split(" ")[0] || "Account"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-lg border-border/60 bg-background/95 backdrop-blur-xl mt-2">
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-semibold text-foreground truncate">{session.user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session.user?.email}</p>
                  </div>

                  <DropdownMenuSeparator />

                  <Link href="/profile">
                    <DropdownMenuItem className="rounded-lg py-2 px-3 cursor-pointer">
                      <UserIcon className="mr-2 h-4 w-4 opacity-70" />
                      <span className="text-sm">My Profile</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/profile">
                    <DropdownMenuItem className="rounded-lg py-2 px-3 cursor-pointer">
                      <Calendar className="mr-2 h-4 w-4 opacity-70" />
                      <span className="text-sm">My Events</span>
                    </DropdownMenuItem>
                  </Link>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="rounded-lg py-2 px-3 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={() => signOut({ callbackUrl: "/" })}
                  >
                    <LogOut className="mr-2 h-4 w-4 opacity-70" />
                    <span className="text-sm font-medium">Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => setIsLoginModalOpen(true)}
                aria-label="Sign in"
                className={cn(
                  "h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-all duration-300 sm:px-5",
                  useLightText
                    ? "bg-white text-black hover:bg-white/90 shadow-lg"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
                )}
              >
                {/* Icon-only on a phone so the brand name has room. The mobile
                    menu still carries a full-width "Sign In" of its own. */}
                <LogIn className="h-4 w-4 opacity-80 sm:mr-2" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )}

            {!hideLinks && (
              <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? "Close menu" : "Open menu"}
                className={cn(
                  "lg:hidden p-2 rounded-lg transition-colors",
                  useLightText ? "text-white hover:bg-white/10" : "text-foreground hover:bg-muted"
                )}
              >
                {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="lg:hidden border-t border-border/60 bg-background/95 backdrop-blur-xl overflow-y-auto max-h-[calc(100vh-64px)]"
            >
              <div className="px-4 sm:px-6 py-5 pb-8 flex flex-col gap-5">
                <nav className="flex flex-col gap-1">
                  {visibleNavItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center gap-3.5 py-3 px-4 rounded-xl text-base font-medium transition-colors",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <item.icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>

                <div className="h-px bg-border/60" />

                {status === "loading" ? (
                  <div className="py-4 flex justify-center">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : session ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3.5 px-1">
                      <div className="h-11 w-11 rounded-full overflow-hidden shrink-0 border border-border/60">
                        {session.user?.image ? (
                          <img src={session.user.image} alt={session.user.name || ""} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-primary/15 flex items-center justify-center text-primary font-bold">
                            {session.user?.name?.substring(0, 1).toUpperCase() || "U"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{session.user?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{session.user?.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href="/profile"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border/60 text-sm font-medium hover:bg-muted transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-primary" />
                        Profile
                      </Link>
                      <Link
                        href="/events/my"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border/60 text-sm font-medium hover:bg-muted transition-colors"
                      >
                        <Calendar className="w-4 h-4 text-primary" />
                        My Events
                      </Link>
                    </div>

                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-destructive border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setIsLoginModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => {
          setIsLoginModalOpen(false);
          if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get("auth") === "login") {
              urlParams.delete("auth");
              const cleanSearch = urlParams.toString();
              const newUrl = cleanSearch ? `${window.location.pathname}?${cleanSearch}` : window.location.pathname;
              router.replace(newUrl, { scroll: false });
            }
          }
        }} 
      />
    </>
  );
}
