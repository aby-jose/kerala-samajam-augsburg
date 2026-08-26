"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const WIDTH = 256; // matches the panel's w-64
const MARGIN = 8; // min gap kept from the viewport edge

/**
 * A small (i) button that reveals a longer explanation on click — for
 * labels that need more detail than fits inline, without resorting to the
 * browser's plain `title` tooltip. Closes on an outside click or Escape,
 * matching the pattern in icon-picker.tsx.
 *
 * The panel is portaled to `document.body` and positioned from the
 * trigger's live screen coordinates (clamped to the viewport, flipped
 * above if there's no room below) rather than being an absolutely
 * positioned descendant of the button. That matters here because the
 * button sits inside a scrollable, `overflow-hidden` card — an in-place
 * absolute panel would get clipped at the card's edge instead of floating
 * over it.
 */
export function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Pass 1: place the panel below-right of the icon, clamped horizontally.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(Math.max(rect.right - WIDTH, MARGIN), window.innerWidth - WIDTH - MARGIN);
      setPos({ top: rect.bottom + 6, left });
    }
    place();
    // Capture-phase so scrolling any ancestor (not just the window) keeps
    // the panel glued to the icon instead of drifting away from it.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Pass 2: now that the panel exists and has a real height, flip it above
  // the icon if it would otherwise run off the bottom of the viewport.
  useLayoutEffect(() => {
    if (!open || !pos || !panelRef.current || !buttonRef.current) return;
    const panelRect = panelRef.current.getBoundingClientRect();
    if (panelRect.bottom > window.innerHeight - MARGIN) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const flippedTop = buttonRect.top - panelRect.height - 6;
      if (Math.abs(flippedTop - pos.top) > 1) setPos({ ...pos, top: flippedTop });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos?.top, pos?.left]);

  useLayoutEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
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

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          // Guard against the label this sits in forwarding the click to
          // its checkbox.
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="More information"
        aria-expanded={open}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              role="tooltip"
              style={{ position: "fixed", top: pos.top, left: pos.left, width: WIDTH }}
              className="z-50 rounded-lg border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-lg"
            >
              {text}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
