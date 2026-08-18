import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_CONTENT,
  HOME_SECTION_IDS,
  homeContentSchema,
  mergeHomeContent,
} from "@/lib/home-schema";
import { repairLayout, resolveSections } from "@/lib/home-layout";

describe("home content schema", () => {
  it("accepts the built-in defaults", () => {
    expect(() => homeContentSchema.parse(DEFAULT_HOME_CONTENT)).not.toThrow();
  });

  it("gives every section id a default content block", () => {
    for (const id of HOME_SECTION_IDS) {
      expect(DEFAULT_HOME_CONTENT.content[id], id).toBeTruthy();
    }
  });

  it("opens with the hero and lists every section exactly once", () => {
    expect(DEFAULT_HOME_CONTENT.layout[0].id).toBe("hero");
    expect(DEFAULT_HOME_CONTENT.layout.map((s) => s.id).sort()).toEqual(
      [...HOME_SECTION_IDS].sort()
    );
  });
});

describe("mergeHomeContent", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(mergeHomeContent(undefined)).toEqual(DEFAULT_HOME_CONTENT.content);
  });

  it("keeps stored fields and fills the rest from defaults", () => {
    const merged = mergeHomeContent({ hero: { headline: "Edited headline" } });

    expect(merged.hero.headline).toBe("Edited headline");
    expect(merged.hero.lead).toBe(DEFAULT_HOME_CONTENT.content.hero.lead);
    expect(merged.about).toEqual(DEFAULT_HOME_CONTENT.content.about);
  });

  it("falls back to the default list when a stored array is empty", () => {
    const merged = mergeHomeContent({
      about: { pillars: [] },
      join: { steps: [] },
    });

    expect(merged.about.pillars).toEqual(DEFAULT_HOME_CONTENT.content.about.pillars);
    expect(merged.join.steps).toEqual(DEFAULT_HOME_CONTENT.content.join.steps);
  });

  it("keeps a stored reels heading and fills the rest from defaults", () => {
    const merged = mergeHomeContent({ reels: { heading: "Latest Clips" } });

    expect(merged.reels.heading).toBe("Latest Clips");
    expect(merged.reels.maxCount).toBe(DEFAULT_HOME_CONTENT.content.reels.maxCount);
  });

  it("ignores section keys it does not recognise", () => {
    const merged = mergeHomeContent({ nonsense: { title: "x" } }) as Record<string, unknown>;
    expect(merged.nonsense).toBeUndefined();
  });

  it("produces something the schema still accepts", () => {
    const content = mergeHomeContent({ hero: { headline: "Edited headline" } });
    expect(() =>
      homeContentSchema.parse({ layout: DEFAULT_HOME_CONTENT.layout, content })
    ).not.toThrow();
  });
});

describe("repairLayout", () => {
  it("returns every section, in default order and visible, when nothing is stored", () => {
    // Deliberately not compared against DEFAULT_HOME_CONTENT.layout as-is any
    // more: `reels` ships hidden (it renders nothing until an admin features a
    // reel), while repairLayout's contract is to re-append any section it does
    // not find as *visible*. The two are no longer the same object, and the
    // difference doesn't reach a fresh site — getHomeContent short-circuits to
    // DEFAULT_HOME_CONTENT when no document is stored, so the defaults, not
    // this path, decide what a never-saved home page renders.
    expect(repairLayout(undefined)).toEqual(
      DEFAULT_HOME_CONTENT.layout.map((s) => ({ ...s, visible: true }))
    );
  });

  it("appends sections missing from a stored layout, visible", () => {
    const repaired = repairLayout([
      { id: "hero", visible: true },
      { id: "cta", visible: false },
    ]);

    expect(repaired.map((s) => s.id)).toContain("gallery");
    expect(repaired.find((s) => s.id === "gallery")?.visible).toBe(true);
    expect(repaired.find((s) => s.id === "cta")?.visible).toBe(false);
    expect(repaired).toHaveLength(8);
  });

  it("drops ids it does not recognise and collapses duplicates", () => {
    const repaired = repairLayout([
      { id: "hero", visible: true },
      { id: "obsolete", visible: true },
      { id: "join", visible: false },
      { id: "join", visible: true },
    ]);

    expect(repaired.map((s) => s.id)).not.toContain("obsolete");
    expect(repaired.filter((s) => s.id === "join")).toHaveLength(1);
    expect(repaired.find((s) => s.id === "join")?.visible).toBe(false);
  });

  it("forces the hero to the top wherever it was stored", () => {
    const repaired = repairLayout([
      { id: "join", visible: true },
      { id: "hero", visible: false },
    ]);

    expect(repaired[0].id).toBe("hero");
    expect(repaired[0].visible).toBe(false);
  });
});

describe("resolveSections", () => {
  it("reproduces today's surfaces at the default order", () => {
    const resolved = resolveSections(DEFAULT_HOME_CONTENT.layout);

    expect(resolved.map((s) => [s.id, s.surface])).toEqual([
      ["hero", "bg-black"],
      ["about", "bg-surface-1"],
      ["events", "bg-surface-2"],
      ["gallery", "bg-surface-1"],
      ["committee", "bg-surface-3"],
      ["join", "bg-surface-1"],
      ["cta", "bg-surface-deep"],
    ]);

    expect(resolved.filter((s) => s.bordered).map((s) => s.id)).toEqual([
      "events",
      "committee",
    ]);
  });

  it("gives the hero and the CTA band dark type", () => {
    const resolved = resolveSections(DEFAULT_HOME_CONTENT.layout);
    expect(resolved.find((s) => s.id === "hero")?.tone).toBe("dark");
    expect(resolved.find((s) => s.id === "cta")?.tone).toBe("dark");
    expect(resolved.find((s) => s.id === "about")?.tone).toBe("surface");
  });

  it("skips hidden sections", () => {
    const resolved = resolveSections([
      { id: "hero", visible: true },
      { id: "about", visible: false },
      { id: "events", visible: true },
    ]);

    expect(resolved.map((s) => s.id)).toEqual(["hero", "events"]);
    // events is now the first rotating section, so it takes the base surface
    expect(resolved[1].surface).toBe("bg-surface-1");
    expect(resolved[1].bordered).toBe(false);
  });

  it("never puts two identical surfaces next to each other, in any order", () => {
    const movable = ["about", "events", "gallery", "reels", "committee", "join", "cta"] as const;

    const permute = <T,>(items: readonly T[]): T[][] =>
      items.length <= 1
        ? [[...items]]
        : items.flatMap((item, i) =>
            permute([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
              item,
              ...rest,
            ])
          );

    for (const order of permute(movable)) {
      const resolved = resolveSections([
        { id: "hero", visible: true },
        ...order.map((id) => ({ id, visible: true })),
      ]);

      for (let i = 1; i < resolved.length; i++) {
        expect(
          resolved[i].surface,
          `${resolved[i - 1].id} → ${resolved[i].id}`
        ).not.toBe(resolved[i - 1].surface);
      }
    }
  });
});

import { splitOnAccent } from "@/lib/accent";

describe("splitOnAccent", () => {
  it("splits a title around the accent word", () => {
    expect(splitOnAccent("A home for Kerala in Augsburg", "Kerala")).toEqual({
      before: "A home for ",
      match: "Kerala",
      after: " in Augsburg",
    });
  });

  it("returns the whole title when the accent is blank", () => {
    expect(splitOnAccent("Upcoming Events", "")).toEqual({
      before: "Upcoming Events",
      match: "",
      after: "",
    });
  });

  it("returns the whole title when the accent is absent or differs in case", () => {
    expect(splitOnAccent("Upcoming Events", "Missing").match).toBe("");
    expect(splitOnAccent("Upcoming Events", "events").match).toBe("");
  });

  it("splits on the first occurrence only", () => {
    expect(splitOnAccent("Events after Events", "Events")).toEqual({
      before: "",
      match: "Events",
      after: " after Events",
    });
  });
});
