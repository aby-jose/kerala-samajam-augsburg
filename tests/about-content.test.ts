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
 * eyebrow/title/accentWord. That is the real shape being fixtured here.
 *
 * Every value below is deliberately DIFFERENT from DEFAULT_ABOUT_CONTENT —
 * not a transcription of it. If the fixture's values coincided with the
 * defaults, a migration that discarded the stored document and fell back
 * to defaults would make every assertion below pass anyway, and the test
 * would prove nothing. Distinct values are what let the assertions tell
 * "stored value survived the lift" apart from "default happened to match".
 *
 * If the read path merged this against the new {layout, content} shape
 * instead of lifting it, every one of these fields would read as an
 * unrecognised key and be silently dropped — reverting the live page to
 * its defaults with no error.
 */
const LEGACY_ABOUT_DOCUMENT = {
  eyebrow: "Est. 2012",
  title: "The Story of Our Verein",
  accentWord: "Verein",
  lead: "This lead paragraph exists only in the legacy fixture and matches nothing in DEFAULT_ABOUT_CONTENT, so its survival through the lift is a real assertion.",
  heroImageUrl: "/uploads/legacy-custom-hero.jpg",
  storyEyebrow: "How it began",
  storyTitle: "A Heading That Is Not The Default",
  storyAccentWord: "Not The Default",
  cards: [
    {
      icon: "Globe",
      title: "Legacy Card Title One",
      description: "A distinct legacy description for card one, matching no default copy.",
    },
    {
      icon: "Star",
      title: "Legacy Card Title Two",
      description: "A distinct legacy description for card two, matching no default copy.",
    },
    {
      icon: "Handshake",
      title: "Legacy Card Title Three",
      description: "A distinct legacy description for card three, matching no default copy.",
    },
  ],
};

describe("liftLegacyAboutContent", () => {
  it("lifts every flat legacy field into its new per-section home", () => {
    const lifted = liftLegacyAboutContent(LEGACY_ABOUT_DOCUMENT);

    expect(lifted.hero).toEqual({
      eyebrow: "Est. 2012",
      title: "The Story of Our Verein",
      accentWord: "Verein",
      lead: LEGACY_ABOUT_DOCUMENT.lead,
      heroImageUrl: "/uploads/legacy-custom-hero.jpg",
    });

    expect(lifted.story).toEqual({
      eyebrow: "How it began",
      title: "A Heading That Is Not The Default",
      accentWord: "Not The Default",
      cards: LEGACY_ABOUT_DOCUMENT.cards,
    });

    // Neither slice coincides with the defaults — guards against a lift
    // that ignores its argument and returns DEFAULT_ABOUT_CONTENT instead.
    expect(lifted.hero).not.toEqual(DEFAULT_ABOUT_CONTENT.content.hero);
    expect(lifted.story).not.toEqual(DEFAULT_ABOUT_CONTENT.content.story);
  });

  it("a lifted legacy document, merged over defaults, still carries every stored value through to the schema shape the page reads", () => {
    const lifted = liftLegacyAboutContent(LEGACY_ABOUT_DOCUMENT);
    const merged = mergeAboutContent(lifted);

    // The exact assertion that matters: nothing an admin saved is lost —
    // and every value asserted here is absent from DEFAULT_ABOUT_CONTENT,
    // so a migration that discarded the stored document (equivalent to
    // mergeAboutContent({})) would fail every line below rather than
    // passing by coincidence.
    expect(merged.hero.eyebrow).toBe("Est. 2012");
    expect(merged.hero.title).toBe("The Story of Our Verein");
    expect(merged.hero.accentWord).toBe("Verein");
    expect(merged.hero.lead).toBe(LEGACY_ABOUT_DOCUMENT.lead);
    expect(merged.hero.heroImageUrl).toBe("/uploads/legacy-custom-hero.jpg");

    expect(merged.story.eyebrow).toBe("How it began");
    expect(merged.story.title).toBe("A Heading That Is Not The Default");
    expect(merged.story.accentWord).toBe("Not The Default");
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
