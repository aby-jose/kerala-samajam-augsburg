import { describe, expect, it } from "vitest";
import { repairLayout, resolveSections, type SectionMeta } from "@/lib/page-layout";

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
