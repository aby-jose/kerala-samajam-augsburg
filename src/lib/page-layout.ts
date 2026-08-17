export type SurfaceMode = "media" | "rotate" | "deep";

export type SectionMeta = {
  label: string;
  description: string;
  surfaceMode: SurfaceMode;
  movable: boolean;
};

export type LayoutEntry = { id: string; visible: boolean };

export type ResolvedSection = {
  id: string;
  surface: string;
  tone: "surface" | "dark";
  bordered: boolean;
};

const isSectionId = <Id extends string>(
  ids: readonly Id[],
  value: unknown
): value is Id => typeof value === "string" && (ids as readonly string[]).includes(value);

/**
 * Make any stored layout renderable: drop ids we no longer ship, collapse
 * duplicates keeping the first, append sections added since the document was
 * saved (visible, at the end), and pin every unmovable section to its
 * canonical position in `ids`.
 *
 * Without the append, a section introduced in a later release would be
 * invisible on every site that had already saved once.
 */
export function repairLayout<Id extends string>(
  ids: readonly Id[],
  meta: Record<Id, SectionMeta>,
  stored: unknown
): LayoutEntry[] {
  const entries = Array.isArray(stored) ? stored : [];
  const seen = new Set<Id>();
  const repaired: LayoutEntry[] = [];

  for (const entry of entries) {
    const id = (entry as { id?: unknown })?.id;
    if (!isSectionId(ids, id) || seen.has(id)) continue;

    seen.add(id);
    repaired.push({ id, visible: (entry as { visible?: unknown }).visible !== false });
  }

  for (const id of ids) {
    if (!seen.has(id)) repaired.push({ id, visible: true });
  }

  // Pin every unmovable section to its canonical position in `ids`, keeping
  // whatever visibility it had. Walking `ids` in order and re-splicing each
  // unmovable id into place handles any number of them, not just one.
  for (const id of ids) {
    if (meta[id].movable) continue;

    const canonicalIndex = ids.indexOf(id);
    const currentIndex = repaired.findIndex((s) => s.id === id);
    if (currentIndex > -1 && currentIndex !== canonicalIndex) {
      repaired.splice(canonicalIndex, 0, ...repaired.splice(currentIndex, 1));
    }
  }

  return repaired.length ? repaired : ids.map((id) => ({ id, visible: true }));
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

export function resolveSections<Id extends string>(
  meta: Record<Id, SectionMeta>,
  layout: LayoutEntry[]
): ResolvedSection[] {
  let rotatingIndex = 0;

  return layout
    .filter((section) => section.visible)
    .map(({ id }) => {
      const { surfaceMode } = meta[id as Id];

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
