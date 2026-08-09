"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Search field with leading icon, sized to match h-9/h-10 toolbar controls.
 */
export const SearchInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <div className={cn("relative", className)}>
    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <input
      ref={ref}
      type="search"
      className="h-10 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.03)] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
      {...props}
    />
  </div>
));
SearchInput.displayName = "SearchInput";
