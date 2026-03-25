"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Calendar, Info, Home, Image as ImageIcon, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { name: "Home", href: "/", icon: Home },
  { name: "About", href: "/about", icon: Info },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "Gallery", href: "/gallery", icon: ImageIcon },
  { name: "Contact", href: "/contact", icon: Mail },
];

export interface NavbarProps {
  hideLinks?: boolean;
  forceLightText?: boolean;
}

export function Navbar({ hideLinks = false, forceLightText = false }: NavbarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Transparent on ALL pages until scroll.
  const isSolid = scrolled;

  // Hero Video check or forced light text
  const useLightText = forceLightText || (isHomePage && !scrolled && !isOpen);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        isSolid
          ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-sm py-2"
          : "bg-transparent border-b border-transparent py-4"
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-2 transition-opacity hover:opacity-90">
          <span className={cn(
            "text-xl md:text-2xl font-sans font-semibold tracking-tight transition-colors duration-300",
            useLightText ? "text-white" : "text-foreground"
          )}>
            Kerala Samajam <span className="text-primary">&nbsp;Augsburg</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        {!hideLinks && (
          <nav className="hidden lg:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 relative py-2 px-1 hover:text-primary",
                  pathname === item.href
                    ? (useLightText ? "text-white" : "text-primary")
                    : (useLightText ? "text-white/80" : "text-muted-foreground hover:text-foreground")
                )}
              >
                {item.name}
                {pathname === item.href && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-0.5",
                      useLightText ? "bg-white" : "bg-primary"
                    )}
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center space-x-1 sm:space-x-4">
          <div className="hidden lg:block">
            <ThemeToggle className={useLightText ? "text-white hover:bg-white/10" : "text-foreground"} />
          </div>
          {!hideLinks && (
            <div className="lg:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                  "transition-colors p-2 rounded-md",
                  useLightText ? "text-white hover:bg-white/10" : "text-foreground hover:bg-muted"
                )}
              >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          )}
          {hideLinks && (
            <div className="lg:hidden">
              <ThemeToggle />
            </div>
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
            className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col space-y-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Main Menu</span>
                <ThemeToggle />
              </div>
              <div className="grid grid-cols-1 gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "text-xl font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center gap-4",
                      pathname === item.href
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", pathname === item.href ? "text-primary" : "text-muted-foreground")} />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
