import {
  Calendar,
  GraduationCap,
  Globe,
  HeartHandshake,
  Sparkles,
  Ticket,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";

import type { MEMBERSHIP_ICONS } from "./membership";

/** Name -> component map for the membership benefit cards, shared by the
 *  admin icon picker (membership-content-editor.tsx) and the public renderer
 *  (membership-client.tsx) so both stay in sync with MEMBERSHIP_ICONS. */
export const MEMBERSHIP_ICON_MAP: Record<(typeof MEMBERSHIP_ICONS)[number], LucideIcon> = {
  Globe,
  HeartHandshake,
  Sparkles,
  GraduationCap,
  Calendar,
  Vote,
  Users,
  Ticket,
};
