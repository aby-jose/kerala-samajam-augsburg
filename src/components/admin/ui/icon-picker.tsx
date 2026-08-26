"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { LucideIcon } from "@/components/icons/lucide-icon";
import { LUCIDE_ICON_NAMES } from "@/lib/icons/lucide-icon-names";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 60;

/**
 * Icon dropdown for the admin content editors, replacing a plain `<select>`
 * over a curated 8-icon list with a searchable grid over every lucide-react
 * icon. `favorites` are shown before the admin types anything — normally the
 * page's original curated set, so the icons people already used stay the
 * fastest to pick. Backed by react-hook-form's Controller (its value is a
 * plain string, not a native form control) — see about-fields.tsx for a
 * usage example.
 */
export function IconPicker({
  value,
  onChange,
  favorites,
}: {
  value: string;
  onChange: (name: string) => void;
  favorites?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    if (!q) return (favorites ?? LUCIDE_ICON_NAMES.slice(0, MAX_RESULTS)) as readonly string[];
    return LUCIDE_ICON_NAMES.filter((name) => name.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
  }, [query, favorites]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-muted/60 bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <LucideIcon name={value} className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-left">{value}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-lg border border-border bg-popover p-2 shadow-lg">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${LUCIDE_ICON_NAMES.length} icons…`}
              className="h-8 w-full rounded-md border border-muted/60 bg-background pl-8 pr-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>

          <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
            {results.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
                  name === value && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                )}
              >
                <LucideIcon name={name} className="h-4 w-4" />
              </button>
            ))}
          </div>

          {!query && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Suggestions shown — type to search all {LUCIDE_ICON_NAMES.length} icons.
            </p>
          )}
          {query && results.length === MAX_RESULTS && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Showing the first {MAX_RESULTS} matches — keep typing to narrow it down.
            </p>
          )}
          {query && results.length === 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">No icons match &ldquo;{query}&rdquo;.</p>
          )}
        </div>
      )}
    </div>
  );
}
