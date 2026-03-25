"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("h-10 w-10 rounded-full bg-muted/20 animate-pulse", className)} />
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={cn(
        "relative h-10 w-18 rounded-full p-1 transition-colors duration-500",
        "bg-secondary/50 hover:bg-secondary border border-border/40 focus:outline-none",
        className
      )}
      aria-label="Toggle theme"
    >
      <div className="flex items-center justify-between px-1.5 h-full">
        <Sun className={cn("h-4 w-4 transition-opacity", theme === "dark" ? "opacity-40" : "opacity-100 text-amber-500")} />
        <Moon className={cn("h-4 w-4 transition-opacity", theme === "dark" ? "opacity-100 text-blue-400" : "opacity-40")} />
      </div>
      <motion.div
        className="absolute top-1 left-1 h-8 w-8 rounded-full bg-background shadow-lg flex items-center justify-center border border-border/20"
        animate={{
          x: theme === "dark" ? 32 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
      >
        {theme === "dark" ? (
          <Moon className="h-4 w-4 text-primary" />
        ) : (
          <Sun className="h-4 w-4 text-primary" />
        )}
      </motion.div>
    </button>
  );
}
