import {
  DEFAULT_HOME_CONTENT,
  HOME_SECTION_IDS,
  type HomeContentT,
  type HomeSectionId,
} from "./home-schema";
import { HOME_SECTION_META } from "./home-sections";

export type ResolvedSection = {
  id: HomeSectionId;
  surface: string;
  tone: "surface" | "dark";
  bordered: boolean;
};

const isSectionId = (value: unknown): value is HomeSectionId =>
  typeof value === "string" && (HOME_SECTION_IDS as readonly string[]).includes(value);

/**
 * Make any stored layout renderable: drop ids we no longer ship, collapse
 * duplicates keeping the first, append sections added since the document was
 * saved (visible, at the end), and pin the hero to the top.
 *
 * Without the append, a section introduced in a later release would be
 * invisible on every site that had already saved once.
 */
export function repairLayout(stored: unknown): HomeContentT["layout"] {
  const entries = Array.isArray(stored) ? stored : [];
  const seen = new Set<HomeSectionId>();
  const repaired: HomeContentT["layout"] = [];

  for (const entry of entries) {
    const id = (entry as { id?: unknown })?.id;
    if (!isSectionId(id) || seen.has(id)) continue;

    seen.add(id);
    repaired.push({ id, visible: (entry as { visible?: unknown }).visible !== false });
  }

  for (const id of HOME_SECTION_IDS) {
    if (!seen.has(id)) repaired.push({ id, visible: true });
  }

  const heroIndex = repaired.findIndex((s) => s.id === "hero");
  if (heroIndex > 0) repaired.unshift(...repaired.splice(heroIndex, 1));

  return repaired.length ? repaired : [...DEFAULT_HOME_CONTENT.layout];
}

/**
 * Background, type tone and border for each visible section, derived from
 * position rather than stored.
 *
 * The rotating sections alternate a white base with a tinted band, and the
 * tints themselves alternate cream and blush. At the default order that
 * reproduces today's page exactly — 1, 2, 1, 3, 1 across about, events,
 * gallery, committee and join — and in any order it keeps two identical
 * surfaces from ever landing next to each other. Borders belong to the
 * tinted bands, so a rule always separates two different colours.
 */
const TINTS = ["bg-surface-2", "bg-surface-3"] as const;

export function resolveSections(layout: HomeContentT["layout"]): ResolvedSection[] {
  let rotatingIndex = 0;

  return layout
    .filter((section) => section.visible)
    .map(({ id }) => {
      const { surfaceMode } = HOME_SECTION_META[id];

      if (surfaceMode === "media") {
        return { id, surface: "bg-black", tone: "dark" as const, bordered: false };
      }

      if (surfaceMode === "deep") {
        return { id, surface: "bg-surface-deep", tone: "dark" as const, bordered: false };
      }

      const position = rotatingIndex++;
      const isTinted = position % 2 === 1;

      return {
        id,
        surface: isTinted ? TINTS[((position - 1) / 2) % TINTS.length] : "bg-surface-1",
        tone: "surface" as const,
        bordered: isTinted,
      };
    });
}
