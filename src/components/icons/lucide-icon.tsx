"use client";

import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { HelpCircle, type LucideProps } from "lucide-react";

import { LUCIDE_ICON_KEBAB, type LucideIconName } from "@/lib/icons/lucide-icon-names";

/**
 * Renders any lucide-react icon from its stored PascalCase name (e.g.
 * "Flower2"), lazily loading just that one icon via lucide's DynamicIcon
 * instead of bundling all 1,557 of them. Used by every public renderer that
 * used to import a small hand-picked map of icon components — see
 * lib/icons/lucide-icon-names.ts for the name list and the admin IconPicker
 * that writes these names.
 *
 * Falls back to a generic icon rather than crashing: a hand-edited document,
 * or a name from a lucide-react version this app no longer ships, could hand
 * this a string that isn't in the map.
 */
export function LucideIcon({ name, ...props }: { name: string } & LucideProps) {
  const kebab = LUCIDE_ICON_KEBAB[name as LucideIconName] as IconName | undefined;
  if (!kebab) return <HelpCircle {...props} />;
  return <DynamicIcon name={kebab} {...props} />;
}
