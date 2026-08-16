import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_CONTENT,
  HOME_SECTION_IDS,
  homeContentSchema,
  mergeHomeContent,
} from "@/lib/home-schema";

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
