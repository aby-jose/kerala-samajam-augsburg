import {
  BookOpen,
  Flower2,
  GraduationCap,
  HeartHandshake,
  Languages,
  Music,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";

import type { HOME_ICONS } from "./home-schema";

/** Name → component for the pillar icons. Shared by the admin dropdown and
 *  the renderer so a stored string is never guessed at. */
export const HOME_ICON_MAP: Record<(typeof HOME_ICONS)[number], LucideIcon> = {
  Flower2,
  HeartHandshake,
  Languages,
  Music,
  GraduationCap,
  Users,
  Utensils,
  BookOpen,
};
