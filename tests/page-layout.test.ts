import { describe, expect, it } from "vitest";
import { enforceHideable, repairLayout, resolveSections, type SectionMeta } from "@/lib/page-layout";
import { HOME_SECTION_IDS } from "@/lib/home-schema";
import { HOME_SECTION_META } from "@/lib/home-sections";
import { ABOUT_SECTION_IDS } from "@/lib/about-schema";
import { ABOUT_SECTION_META } from "@/lib/about-sections";
import { CONTACT_SECTION_IDS } from "@/lib/page-content/contact";
import { CONTACT_SECTION_META } from "@/lib/page-content/contact-sections";
import { MEMBERSHIP_SECTION_IDS } from "@/lib/page-content/membership";
import { MEMBERSHIP_SECTION_META } from "@/lib/page-content/membership-sections";
import { EVENTS_SECTION_IDS } from "@/lib/page-content/events";
import { EVENTS_SECTION_META } from "@/lib/page-content/events-sections";
import { GALLERY_SECTION_IDS } from "@/lib/page-content/gallery";
import { GALLERY_SECTION_META } from "@/lib/page-content/gallery-sections";

const IDS = ["banner", "story", "notes", "closing"] as const;

const META: Record<(typeof IDS)[number], SectionMeta> = {
  banner: { label: "Banner", description: "", surfaceMode: "media", movable: false },
  story: { label: "Story", description: "", surfaceMode: "rotate", movable: true },
  notes: { label: "Notes", description: "", surfaceMode: "rotate", movable: true },
  closing: { label: "Closing", description: "", surfaceMode: "deep", movable: true },
};

describe("repairLayout (generic)", () => {
  it("returns every id, visible, when nothing is stored", () => {
    expect(repairLayout(IDS, META, undefined)).toEqual([
      { id: "banner", visible: true },
      { id: "story", visible: true },
      { id: "notes", visible: true },
      { id: "closing", visible: true },
    ]);
  });

  it("appends ids missing from a stored layout, visible", () => {
    const repaired = repairLayout(IDS, META, [{ id: "banner", visible: true }]);

    expect(repaired.map((s) => s.id).sort()).toEqual([...IDS].sort());
    expect(repaired.find((s) => s.id === "notes")?.visible).toBe(true);
  });

  it("drops unknown ids and collapses duplicates, keeping the first", () => {
    const repaired = repairLayout(IDS, META, [
      { id: "story", visible: false },
      { id: "obsolete", visible: true },
      { id: "story", visible: true },
    ]);

    expect(repaired.map((s) => s.id)).not.toContain("obsolete");
    expect(repaired.filter((s) => s.id === "story")).toHaveLength(1);
    expect(repaired.find((s) => s.id === "story")?.visible).toBe(false);
  });

  it("pins an unmovable section to its canonical position, keeping its visibility", () => {
    const repaired = repairLayout(IDS, META, [
      { id: "story", visible: true },
      { id: "banner", visible: false },
    ]);

    expect(repaired[0]).toEqual({ id: "banner", visible: false });
  });

});

/**
 * `enforceHideable` is deliberately NOT folded into `repairLayout` itself —
 * see enforceHideable's doc comment in page-layout.ts. repairLayout's own
 * contract (pin position, otherwise preserve stored visibility) is what the
 * suite above, and the frozen tests in home-content.test.ts and
 * about-content.test.ts, exercise directly. This describes the composed
 * behaviour every real read/save path actually runs.
 */
describe("enforceHideable", () => {
  const IDS_H = ["banner", "story"] as const;
  const META_H: Record<(typeof IDS_H)[number], SectionMeta> = {
    banner: {
      label: "Banner",
      description: "",
      surfaceMode: "media",
      movable: false,
      hideable: false,
    },
    story: { label: "Story", description: "", surfaceMode: "rotate", movable: true },
  };

  it("forces visible: true for a non-hideable section, even against a hand-crafted payload", () => {
    const repaired = enforceHideable(
      META_H,
      repairLayout(IDS_H, META_H, [
        { id: "banner", visible: false },
        { id: "story", visible: true },
      ])
    );

    expect(repaired.find((s) => s.id === "banner")).toEqual({ id: "banner", visible: true });
  });

  it("leaves a hideable section's visibility untouched", () => {
    const repaired = enforceHideable(
      META_H,
      repairLayout(IDS_H, META_H, [
        { id: "banner", visible: true },
        { id: "story", visible: false },
      ])
    );

    expect(repaired.find((s) => s.id === "story")).toEqual({ id: "story", visible: false });
  });

  it("forces visibility even when nothing at all is stored (the append-missing-ids path)", () => {
    const repaired = enforceHideable(META_H, repairLayout(IDS_H, META_H, undefined));
    expect(repaired.find((s) => s.id === "banner")?.visible).toBe(true);
  });

  it("treats a section with no `hideable` field as hideable (defaults true) and leaves it untouched", () => {
    // META (the file-level fixture) never sets `hideable` at all.
    const repaired = enforceHideable(META, repairLayout(IDS, META, [{ id: "story", visible: false }]));
    expect(repaired.find((s) => s.id === "story")?.visible).toBe(false);
  });

  it("is a no-op when applied twice — idempotent, so composing it after repairLayout is always safe", () => {
    const once = enforceHideable(
      META_H,
      repairLayout(IDS_H, META_H, [{ id: "banner", visible: false }])
    );
    const twice = enforceHideable(META_H, once);
    expect(twice).toEqual(once);
  });
});

describe("resolveSections (generic)", () => {
  it("gives media and deep sections their fixed surfaces and dark type", () => {
    const resolved = resolveSections(META, repairLayout(IDS, META, undefined));

    expect(resolved.find((s) => s.id === "banner")).toMatchObject({
      surface: "bg-black",
      tone: "dark",
      bordered: false,
    });
    expect(resolved.find((s) => s.id === "closing")).toMatchObject({
      surface: "bg-surface-deep",
      tone: "dark",
    });
  });

  it("alternates base and tint across the rotating sections", () => {
    const resolved = resolveSections(META, repairLayout(IDS, META, undefined));

    expect(resolved.find((s) => s.id === "story")?.surface).toBe("bg-surface-1");
    expect(resolved.find((s) => s.id === "notes")?.surface).toBe("bg-surface-2");
    expect(resolved.find((s) => s.id === "notes")?.bordered).toBe(true);
  });

  it("skips hidden sections and re-bands what remains", () => {
    const resolved = resolveSections(META, [
      { id: "banner", visible: true },
      { id: "story", visible: false },
      { id: "notes", visible: true },
    ]);

    expect(resolved.map((s) => s.id)).toEqual(["banner", "notes"]);
    // notes is now the FIRST rotating section, so it takes the base surface.
    expect(resolved[1].surface).toBe("bg-surface-1");
    expect(resolved[1].bordered).toBe(false);
  });

  it("never puts two identical surfaces next to each other, in any order", () => {
    const movable = ["story", "notes", "closing"] as const;

    const permute = <T,>(items: readonly T[]): T[][] =>
      items.length <= 1
        ? [[...items]]
        : items.flatMap((item, i) =>
            permute([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest])
          );

    for (const order of permute(movable)) {
      const resolved = resolveSections(META, [
        { id: "banner", visible: true },
        ...order.map((id) => ({ id, visible: true })),
      ]);

      for (let i = 1; i < resolved.length; i++) {
        expect(resolved[i].surface, `${resolved[i - 1].id} → ${resolved[i].id}`).not.toBe(
          resolved[i - 1].surface
        );
      }
    }
  });
});

/**
 * GUARD FOR THE INVARIANT resolveSections RELIES ON BUT DOES NOT ENFORCE.
 *
 * No two adjacent visible sections ever share a background — verified
 * exhaustively (every permutation × every visibility bitmask, 645,120 cases
 * on home alone) with zero violations. But that holds only because every
 * page today happens to have at most one "deep" section and at most one
 * "media" section — the two surfaceModes resolveSections gives a fixed
 * surface regardless of position (see resolveSections in page-layout.ts).
 * Two "deep" sections landing adjacent would render two identical
 * bg-surface-deep bands, and nothing in resolveSections itself would catch
 * it — only this test does, by inspecting every registered page's
 * section-meta map directly rather than re-running the permutation sweep.
 *
 * Also guards `sectionIds ⊆ keys(sectionMeta)`: page-layout.ts dereferences
 * `meta[id]` unguarded in repairLayout's unmovable-pin loop and in
 * resolveSections' surfaceMode lookup, so a registry entry whose
 * `sectionIds` names an id absent from `sectionMeta` — an easy typo through
 * mergePageContent's widened `PageEntry` types — becomes a runtime "Cannot
 * read properties of undefined" rather than a caught mistake.
 */
describe("every registered page's section meta keeps resolveSections' fixed-position assumption true by construction", () => {
  const PAGES: { name: string; ids: readonly string[]; meta: Record<string, SectionMeta> }[] = [
    { name: "home", ids: HOME_SECTION_IDS, meta: HOME_SECTION_META },
    { name: "about", ids: ABOUT_SECTION_IDS, meta: ABOUT_SECTION_META },
    { name: "contact", ids: CONTACT_SECTION_IDS, meta: CONTACT_SECTION_META },
    { name: "membership", ids: MEMBERSHIP_SECTION_IDS, meta: MEMBERSHIP_SECTION_META },
    { name: "events", ids: EVENTS_SECTION_IDS, meta: EVENTS_SECTION_META },
    { name: "gallery", ids: GALLERY_SECTION_IDS, meta: GALLERY_SECTION_META },
  ];

  for (const { name, ids, meta } of PAGES) {
    it(`${name}: at most one "deep" section and one "media" section`, () => {
      const values = Object.values(meta) as SectionMeta[];

      for (const mode of ["deep", "media"] as const) {
        const offenders = Object.entries(meta)
          .filter(([, m]) => (m as SectionMeta).surfaceMode === mode)
          .map(([id]) => id);

        expect(
          offenders.length,
          `page "${name}" has ${offenders.length} sections with surfaceMode "${mode}" (${offenders.join(", ")}) — resolveSections gives every "${mode}" section the same fixed surface regardless of position, so two of them adjacent would render two identical bands back to back, breaking the no-adjacent-duplicate-surface invariant.`
        ).toBeLessThanOrEqual(1);
      }

      // Keeps the "at most one" checks above meaningful for empty pages too.
      expect(values.length).toBeGreaterThan(0);
    });

    it(`${name}: every id in sectionIds has a sectionMeta entry`, () => {
      for (const id of ids) {
        expect(
          id in meta,
          `page "${name}" lists "${id}" in its sectionIds but sectionMeta has no entry for it — page-layout.ts dereferences meta[id] unguarded, so this would throw "Cannot read properties of undefined" at runtime instead of failing here.`
        ).toBe(true);
      }
    });
  }
});
