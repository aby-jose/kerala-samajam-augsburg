"use client";

import { useState } from "react";
import { ChevronDown, MoveDown, MoveUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cardSurface, panelHeader } from "@/components/admin/ui/surface";
import { cn } from "@/lib/utils";

/**
 * One collapsible section in the home page editor: label, a visibility
 * toggle, and move buttons. Collapsed by default so seven sections stay
 * scannable. Move buttons rather than drag handles — the About card editor
 * already uses them, they need no dependency, and they work from a keyboard.
 */
export function SectionCard({
  label,
  description,
  visible,
  onVisibleChange,
  onMoveUp,
  onMoveDown,
  movable,
  children,
}: {
  label: string;
  description: string;
  visible: boolean;
  onVisibleChange: (next: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  movable: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn(cardSurface, !visible && "opacity-60")}>
      <div className={panelHeader}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          />
          <span>
            <span className="block font-sans text-sm font-semibold text-foreground">{label}</span>
            <span className="block text-xs text-muted-foreground">{description}</span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <label className="mr-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => onVisibleChange(e.target.checked)}
              className="h-4 w-4 rounded border-muted"
            />
            Visible
          </label>

          {movable && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!onMoveUp}
                onClick={onMoveUp}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={`Move ${label} up`}
              >
                <MoveUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!onMoveDown}
                onClick={onMoveDown}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={`Move ${label} down`}
              >
                <MoveDown className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {open && <div className="space-y-5 p-5 sm:p-6">{children}</div>}
    </div>
  );
}
