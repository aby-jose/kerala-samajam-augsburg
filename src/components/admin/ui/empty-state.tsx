import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { chipTone, type ChipTone } from "./surface";

/**
 * Centered empty state for tables and lists. Keep copy short and factual;
 * pass an action button when there is an obvious next step.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {Icon && (
        <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-2xl", chipTone(tone))}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h3 className="font-sans text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
