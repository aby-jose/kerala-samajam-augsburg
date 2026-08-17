import { describe, expect, it } from "vitest";
import {
  ABOUT_SECTION_IDS,
  aboutContentSchema,
  DEFAULT_ABOUT_CONTENT,
  liftLegacyAboutContent,
  mergeAboutContent,
} from "@/lib/about-schema";
import { ABOUT_SECTION_META } from "@/lib/about-sections";
import { repairLayout, resolveSections } from "@/lib/page-layout";

describe("about content schema", () => {
  it("accepts the built-in defaults", () => {
    expect(() => aboutContentSchema.parse(DEFAULT_ABOUT_CONTENT)).not.toThrow();
  });

  it("gives every section id a default content block", () => {
    for (const id of ABOUT_SECTION_IDS) {
      expect(DEFAULT_ABOUT_CONTENT.content[id], id).toBeTruthy();
    }
  });

  it("opens with the hero and lists every section exactly once", () => {
    expect(DEFAULT_ABOUT_CONTENT.layout[0].id).toBe("hero");
    expect(DEFAULT_ABOUT_CONTENT.layout.map((s) => s.id).sort()).toEqual(
      [...ABOUT_SECTION_IDS].sort()
    );
  });
});

describe("mergeAboutContent", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(mergeAboutContent(undefined)).toEqual(DEFAULT_ABOUT_CONTENT.content);
  });

  it("keeps stored fields and fills the rest from defaults", () => {
    const merged = mergeAboutContent({ hero: { title: "Edited title" } });

    expect(merged.hero.title).toBe("Edited title");
    expect(merged.hero.lead).toBe(DEFAULT_ABOUT_CONTENT.content.hero.lead);
    expect(merged.story).toEqual(DEFAULT_ABOUT_CONTENT.content.story);
  });

  it("falls back to the default list when a stored array is empty", () => {
    const merged = mergeAboutContent({ story: { cards: [] } });
    expect(merged.story.cards).toEqual(DEFAULT_ABOUT_CONTENT.content.story.cards);
  });

  it("ignores section keys it does not recognise", () => {
    const merged = mergeAboutContent({ nonsense: { title: "x" } }) as Record<string, unknown>;
    expect(merged.nonsense).toBeUndefined();
  });

  it("produces something the schema still accepts", () => {
    const content = mergeAboutContent({ hero: { title: "Edited title" } });
    expect(() =>
      aboutContentSchema.parse({ layout: DEFAULT_ABOUT_CONTENT.layout, content })
    ).not.toThrow();
  });
});

/**
 * THE MIGRATION. `AboutContent` has exactly one stored row in the live
 * database, saved before sections were orderable. Its shape is flat — no
 * `layout`, no `content` — the document's own keys ARE the content, with
 * the story fields prefixed to disambiguate them from the hero's own
 * eyebrow/title/accentWord. This fixture is that shape, transcribed
 * character-for-character from DEFAULT_ABOUT_CONTENT as it existed before
 * this migration (src/lib/about-schema.ts, pre-restructure):
 *
 *   eyebrow: "About us"
 *   title: "About Kerala Samajam Augsburg"
 *   accentWord: "Kerala"
 *   lead: "A registered Verein in Bavaria, run entirely by its members. ..."
 *   heroImageUrl: "/images/about/hero.png"
 *   storyEyebrow: "Our story"
 *   storyTitle: "Where We Come From"
 *   storyAccentWord: "Come From"
 *   cards: [ ... 3 cards ... ]
 *
 * If the read path merged this against the new {layout, content} shape
 * instead of lifting it, every one of these fields would read as an
 * unrecognised key and be silently dropped — reverting the live page to
 * its defaults with no error.
 */
const LEGACY_ABOUT_DOCUMENT = {
  eyebrow: "About us",
  title: "About Kerala Samajam Augsburg",
  accentWord: "Kerala",
  lead: "A registered Verein in Bavaria, run entirely by its members. We celebrate the festivals, teach the language to our children, and help people find their feet when they arrive in Augsburg.",
  heroImageUrl: "/images/about/hero.png",
  storyEyebrow: "Our story",
  storyTitle: "Where We Come From",
  storyAccentWord: "Come From",
  cards: [
    {
      icon: "History",
      title: "How We Started",
      description:
        "In 2012, a handful of families cooked one Onam sadhya together. Word spread, more families came, and the sadhya never stopped.",
    },
    {
      icon: "Target",
      title: "What We Do",
      description:
        "Festivals through the year, Malayalam classes for the children, dance and music on stage, and a hand for anyone new to the city.",
    },
    {
      icon: "Heart",
      title: "What We Stand For",
      description:
        "Open to everyone, run by members and paid for by members. Nobody here is a customer — you join, and then you help cook.",
    },
  ],
};

describe("liftLegacyAboutContent", () => {
  it("lifts every flat legacy field into its new per-section home", () => {
    const lifted = liftLegacyAboutContent(LEGACY_ABOUT_DOCUMENT);

    expect(lifted.hero).toEqual({
      eyebrow: "About us",
      title: "About Kerala Samajam Augsburg",
      accentWord: "Kerala",
      lead: LEGACY_ABOUT_DOCUMENT.lead,
      heroImageUrl: "/images/about/hero.png",
    });

    expect(lifted.story).toEqual({
      eyebrow: "Our story",
      title: "Where We Come From",
      accentWord: "Come From",
      cards: LEGACY_ABOUT_DOCUMENT.cards,
    });
  });

  it("a lifted legacy document, merged over defaults, still carries every stored value through to the schema shape the page reads", () => {
    const lifted = liftLegacyAboutContent(LEGACY_ABOUT_DOCUMENT);
    const merged = mergeAboutContent(lifted);

    // The exact assertion that matters: nothing an admin saved is lost.
    expect(merged.hero.eyebrow).toBe("About us");
    expect(merged.hero.title).toBe("About Kerala Samajam Augsburg");
    expect(merged.hero.accentWord).toBe("Kerala");
    expect(merged.hero.lead).toBe(LEGACY_ABOUT_DOCUMENT.lead);
    expect(merged.hero.heroImageUrl).toBe("/images/about/hero.png");

    expect(merged.story.eyebrow).toBe("Our story");
    expect(merged.story.title).toBe("Where We Come From");
    expect(merged.story.accentWord).toBe("Come From");
    expect(merged.story.cards).toEqual(LEGACY_ABOUT_DOCUMENT.cards);

    // Sections the legacy document never had an opinion on still get their
    // (trivial) defaults rather than being left undefined.
    expect(merged.committee).toEqual(DEFAULT_ABOUT_CONTENT.content.committee);
    expect(merged.closing).toEqual(DEFAULT_ABOUT_CONTENT.content.closing);

    expect(() =>
      aboutContentSchema.parse({ layout: DEFAULT_ABOUT_CONTENT.layout, content: merged })
    ).not.toThrow();
  });

  it("does not let an explicitly-undefined lifted field clobber a default", () => {
    // A legacy document missing the optional accentWord fields entirely —
    // definedEntries() must drop them rather than spreading `undefined`
    // over the default.
    const { accentWord, storyAccentWord, ...withoutAccents } = LEGACY_ABOUT_DOCUMENT;
    const lifted = liftLegacyAboutContent(withoutAccents);
    const merged = mergeAboutContent(lifted);

    expect(merged.hero.accentWord).toBe(DEFAULT_ABOUT_CONTENT.content.hero.accentWord);
    expect(merged.story.accentWord).toBe(DEFAULT_ABOUT_CONTENT.content.story.accentWord);
  });
});

describe("resolveSections applied to the real About section meta", () => {
  it("reproduces today's opening surfaces, and shows the intended committee colour change", () => {
    const resolved = resolveSections(
      ABOUT_SECTION_META,
      repairLayout(ABOUT_SECTION_IDS, ABOUT_SECTION_META, undefined)
    );

    expect(resolved.map((s) => [s.id, s.surface])).toEqual([
      ["hero", "bg-surface-1"],
      ["story", "bg-surface-2"],
      // Position-derived: committee no longer gets the old hardcoded
      // bg-surface-3 — expected and intended per the plan.
      ["committee", "bg-surface-1"],
      ["closing", "bg-surface-deep"],
    ]);

    expect(resolved.find((s) => s.id === "hero")?.bordered).toBe(false);
    expect(resolved.find((s) => s.id === "story")?.bordered).toBe(true);
    expect(resolved.find((s) => s.id === "closing")?.tone).toBe("dark");
  });

  it("pins the hero to the top no matter what a stored layout says", () => {
    const repaired = repairLayout(ABOUT_SECTION_IDS, ABOUT_SECTION_META, [
      { id: "story", visible: true },
      { id: "hero", visible: false },
    ]);

    expect(repaired[0]).toEqual({ id: "hero", visible: false });
  });
});
