/**
 * Shared class fragments for admin "boxes" — cards, table wrappers, panel
 * headers, icon chips. Centralized so every page reaches for the same
 * premium surface instead of re-deriving borders/radii/shadows by hand.
 *
 * Sidebar, topbar, main panel and cards all stay plain black/white — no
 * color tint. Only the canvas behind them (set in the admin layout) uses a
 * plain neutral gray to stay distinct. Containers are defined primarily by
 * a clearly visible border, not by a lighter fill.
 */

/** The workhorse container: cards, table wrappers, list panels. Matches the panel it sits in. */
export const cardSurface =
  "rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_32px_-24px_rgba(0,0,0,0.18)] dark:border-white/[0.12] dark:bg-black dark:shadow-none";

/** Bigger surfaces the user's attention centers on: modals, feature panels. */
export const heroSurface =
  "rounded-3xl border border-black/[0.08] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.05),0_24px_48px_-24px_rgba(0,0,0,0.28)] dark:border-white/[0.18] dark:bg-black dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_24px_48px_-20px_rgba(0,0,0,0.9)]";

/** Header row inside a cardSurface (title + description + actions). */
export const panelHeader =
  "flex items-center justify-between gap-4 border-b border-black/[0.07] px-5 py-4 sm:px-6 dark:border-white/[0.08]";

/**
 * Table header band. No fill block — a plain, slightly bolder rule under
 * uppercase tracked labels, the way Linear/Stripe do it, rather than a
 * shaded strip competing with the row dividers below it.
 */
export const tableHeadRow = "border-b border-black/[0.12] hover:bg-transparent dark:border-white/[0.14]";

/** Table body row — hover + divider, shared by every list page. */
export const tableRow =
  "border-b border-black/[0.06] transition-colors last:border-0 hover:bg-black/[0.03] dark:border-white/[0.06] dark:hover:bg-white/[0.04]";

/** Outline-style toolbar buttons/dropdown triggers — visible chip in both themes. */
export const toolbarChip =
  "border-black/[0.10] bg-black/[0.03] hover:bg-black/[0.06] dark:border-white/[0.12] dark:bg-white/[0.07] dark:hover:bg-white/[0.11]";

/**
 * Colored icon chip. Tint rotates by semantic meaning so sections read as
 * distinct at a glance instead of every icon sitting in the same gray box.
 */
export type ChipTone = "primary" | "blue" | "emerald" | "amber" | "violet" | "neutral";

const chipToneClasses: Record<ChipTone, string> = {
  primary: "bg-primary/10 text-primary",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  neutral: "bg-black/[0.05] text-muted-foreground dark:bg-white/[0.08]",
};

export function chipTone(tone: ChipTone = "neutral") {
  return chipToneClasses[tone];
}
