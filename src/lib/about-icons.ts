import { BookOpen, Globe, Handshake, Heart, History, Star, Target, Users, type LucideIcon } from "lucide-react";

import { ABOUT_ICONS } from "./about-schema";

/** Name -> component map for the About "Where We Come From" cards, shared by
 * the admin icon picker (about-content-editor.tsx) and the public renderer
 * (about-page-client.tsx) so both stay in sync with ABOUT_ICONS. */
export const ABOUT_ICON_MAP: Record<(typeof ABOUT_ICONS)[number], LucideIcon> = {
  History,
  Target,
  Heart,
  Users,
  Globe,
  Star,
  Handshake,
  BookOpen,
};
