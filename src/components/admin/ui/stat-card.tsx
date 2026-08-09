import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cardSurface, chipTone, type ChipTone } from "./surface";

/**
 * KPI tile for admin overview pages. Value is the hero; the delta reads as
 * a soft colored pill rather than bare arrow+text so it doesn't disappear.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  delta,
  deltaDirection,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: ChipTone;
  delta?: string;
  deltaDirection?: "up" | "down";
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn(cardSurface, "p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", chipTone(tone))}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
      </div>
      <p className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      {(delta || hint) && (
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                deltaDirection === "down"
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {deltaDirection === "down" ? (
                <ArrowDownRight className="h-3 w-3" />
              ) : (
                <ArrowUpRight className="h-3 w-3" />
              )}
              {delta}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  );
}
