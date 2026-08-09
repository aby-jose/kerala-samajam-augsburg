import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "destructive" | "info" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning:
    "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  destructive:
    "bg-red-500/10 text-red-700 dark:text-red-400",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  neutral: "bg-muted text-muted-foreground",
};

/**
 * Dot-style status pill. Use tones, not raw colors, so statuses stay
 * consistent across every admin table and card.
 */
export function StatusBadge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}
