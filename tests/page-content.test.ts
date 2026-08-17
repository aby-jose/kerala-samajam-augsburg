import { describe, expect, it } from "vitest";
import { isPageSlug, mergePageContent, PAGE_SLUGS } from "@/lib/page-content/registry";
import { parseInlineLinks } from "@/lib/page-content/section";
import {
  CONTACT_SECTION_IDS,
  contactContentSchema,
  DEFAULT_CONTACT,
  mergeContactContent,
} from "@/lib/page-content/contact";
import { CONTACT_SECTION_META } from "@/lib/page-content/contact-sections";
import {
  DEFAULT_MEMBERSHIP,
  membershipContentSchema,
  MEMBERSHIP_SECTION_IDS,
  mergeMembershipContent,
} from "@/lib/page-content/membership";
import { MEMBERSHIP_SECTION_META } from "@/lib/page-content/membership-sections";
import { DEFAULT_LISTINGS, listingsContentSchema } from "@/lib/page-content/listings";
import { repairLayout, resolveSections } from "@/lib/page-layout";
import { splitOnAccent } from "@/lib/accent";

describe("page content registry", () => {
  it("recognises its own slugs and nothing else", () => {
    for (const slug of PAGE_SLUGS) expect(isPageSlug(slug)).toBe(true);

    expect(isPageSlug("nonsense")).toBe(false);
    expect(isPageSlug("")).toBe(false);
    expect(isPageSlug(undefined)).toBe(false);
    expect(isPageSlug(42)).toBe(false);
  });

  it("accepts the defaults of every registered page", async () => {
    const { PAGE_CONTENT } = await import("@/lib/page-content/registry");

    for (const slug of PAGE_SLUGS) {
      const { schema, defaults } = PAGE_CONTENT[slug];
      expect(() => schema.parse(defaults), slug).not.toThrow();
    }
  });

  it("gives every page at least one path to revalidate", async () => {
    const { PAGE_CONTENT } = await import("@/lib/page-content/registry");

    for (const slug of PAGE_SLUGS) {
      expect(PAGE_CONTENT[slug].revalidate.length, slug).toBeGreaterThan(0);
    }
  });
});

/**
 * `listings` is the one slug still in the flat, pre-restructure shape (it
 * converts once it splits into `events`/`gallery`) — so it is the one used
 * here to exercise mergePageContent's flat branch. `contact` and
 * `membership` exercise the sectioned branch below.
 */
describe("mergePageContent — flat pages", () => {
  const slug = "listings" as const;

  it("returns the defaults when nothing is stored", async () => {
    const { PAGE_CONTENT } = await import("@/lib/page-content/registry");

    expect(mergePageContent(slug, undefined)).toEqual(PAGE_CONTENT[slug].defaults);
    expect(mergePageContent(slug, null)).toEqual(PAGE_CONTENT[slug].defaults);
  });

  it("keeps a stored section and fills the rest from defaults", async () => {
    const { PAGE_CONTENT } = await import("@/lib/page-content/registry");
    const defaults = PAGE_CONTENT[slug].defaults as Record<string, Record<string, unknown>>;
    const [firstKey, secondKey] = Object.keys(defaults);

    const merged = mergePageContent(slug, {
      [firstKey]: { title: "Edited title" },
    }) as Record<string, Record<string, unknown>>;

    expect(merged[firstKey].title).toBe("Edited title");
    // Sibling fields inside the edited section survive.
    expect(merged[firstKey].lead).toBe(defaults[firstKey].lead);
    // Untouched sections come through whole.
    expect(merged[secondKey]).toEqual(defaults[secondKey]);
  });

  it("drops section keys it does not recognise", () => {
    const merged = mergePageContent(slug, { nonsense: { title: "x" } }) as Record<string, unknown>;

    expect(merged.nonsense).toBeUndefined();
  });

  it("produces something the schema still accepts", async () => {
    const { PAGE_CONTENT } = await import("@/lib/page-content/registry");
    const defaults = PAGE_CONTENT[slug].defaults as Record<string, unknown>;
    const [firstKey] = Object.keys(defaults);

    const merged = mergePageContent(slug, { [firstKey]: { title: "Edited title" } });

    expect(() => PAGE_CONTENT[slug].schema.parse(merged)).not.toThrow();
  });
});

/**
 * THE DISCRIMINATING FIXTURES. Every value below is deliberately DIFFERENT
 * from DEFAULT_CONTACT / DEFAULT_MEMBERSHIP — not a transcription of them.
 * If a fixture's values coincided with the defaults, a merge that discarded
 * the stored document and fell back to defaults would make every assertion
 * below pass anyway, and the test would prove nothing. See the file-level
 * verification note at the bottom of this file for how this was checked.
 */
describe("mergePageContent — sectioned pages (contact, membership)", () => {
  it("repairs layout and merges content for a stored contact document", () => {
    const merged = mergePageContent("contact", {
      layout: [
        { id: "faq", visible: false },
        { id: "hero", visible: true },
        { id: "form", visible: true },
        { id: "visit", visible: true },
      ],
      content: {
        hero: { title: "Reach The Committee Directly" },
      },
    }) as { layout: { id: string; visible: boolean }[]; content: Record<string, Record<string, unknown>> };

    // hero is pinned to the top regardless of what the stored layout says.
    expect(merged.layout[0]).toEqual({ id: "hero", visible: true });
    expect(merged.layout.find((s) => s.id === "faq")).toEqual({ id: "faq", visible: false });

    expect(merged.content.hero.title).toBe("Reach The Committee Directly");
    // Sibling fields inside the edited section survive from defaults.
    expect(merged.content.hero.lead).toBe(DEFAULT_CONTACT.content.hero.lead);
    // Untouched sections come through whole.
    expect(merged.content.form).toEqual(DEFAULT_CONTACT.content.form);
  });

  it("repairs layout and merges content for a stored membership document", () => {
    const merged = mergePageContent("membership", {
      layout: [
        { id: "benefits", visible: true },
        { id: "hero", visible: false },
        { id: "plans", visible: true },
      ],
      content: {
        plans: { title: "Choose Your Tier" },
      },
    }) as { layout: { id: string; visible: boolean }[]; content: Record<string, Record<string, unknown>> };

    expect(merged.layout[0]).toEqual({ id: "hero", visible: false });
    expect(merged.content.plans.title).toBe("Choose Your Tier");
    expect(merged.content.benefits).toEqual(DEFAULT_MEMBERSHIP.content.benefits);
  });

  it("restores the default list when a stored contact faq array is empty", () => {
    const merged = mergePageContent("contact", {
      content: { faq: { items: [] } },
    }) as { content: { faq: { items: unknown[] } } };

    expect(merged.content.faq.items).toEqual(DEFAULT_CONTACT.content.faq.items);
  });

  it("restores the default list when the stored membership benefits value is not an array", () => {
    const merged = mergePageContent("membership", {
      content: { benefits: { items: "not an array" as unknown as never } },
    }) as { content: { benefits: { items: unknown[] } } };

    expect(merged.content.benefits.items).toEqual(DEFAULT_MEMBERSHIP.content.benefits.items);
  });
});

describe("parseInlineLinks", () => {
  it("returns one plain node when there is no link", () => {
    expect(parseInlineLinks("Just a sentence.")).toEqual([{ text: "Just a sentence." }]);
  });

  it("splits a sentence around a link", () => {
    expect(
      parseInlineLinks("Apply through the [membership page](/membership). The committee confirms it.")
    ).toEqual([
      { text: "Apply through the " },
      { text: "membership page", href: "/membership" },
      { text: ". The committee confirms it." },
    ]);
  });

  it("handles a link at the very start and the very end", () => {
    expect(parseInlineLinks("[Events](/events) are open.")).toEqual([
      { text: "Events", href: "/events" },
      { text: " are open." },
    ]);

    expect(parseInlineLinks("See the [events page](/events)")).toEqual([
      { text: "See the " },
      { text: "events page", href: "/events" },
    ]);
  });

  it("handles several links in one answer", () => {
    const nodes = parseInlineLinks("[One](/a) then [two](/b).");

    expect(nodes.filter((n) => n.href)).toEqual([
      { text: "One", href: "/a" },
      { text: "two", href: "/b" },
    ]);
  });

  it("leaves malformed syntax as literal text rather than dropping it", () => {
    // An admin typing a bracket must never make their sentence vanish.
    expect(parseInlineLinks("A [bracket without a link.")).toEqual([
      { text: "A [bracket without a link." },
    ]);
    expect(parseInlineLinks("Empty () parens.")).toEqual([{ text: "Empty () parens." }]);
  });

  it("never returns an empty node", () => {
    for (const node of parseInlineLinks("[Events](/events)")) {
      expect(node.text.length).toBeGreaterThan(0);
    }
  });
});

describe("contact content schema", () => {
  it("accepts its own defaults", () => {
    expect(() => contactContentSchema.parse(DEFAULT_CONTACT)).not.toThrow();
  });

  it("opens with the hero and lists every section exactly once", () => {
    expect(DEFAULT_CONTACT.layout[0].id).toBe("hero");
    expect(DEFAULT_CONTACT.layout.map((s) => s.id).sort()).toEqual([...CONTACT_SECTION_IDS].sort());
  });

  it("ships the four questions the page answers today", () => {
    expect(DEFAULT_CONTACT.content.faq.items).toHaveLength(4);
  });

  it("rejects an empty title", () => {
    expect(() =>
      contactContentSchema.parse({
        ...DEFAULT_CONTACT,
        content: {
          ...DEFAULT_CONTACT.content,
          hero: { ...DEFAULT_CONTACT.content.hero, title: "" },
        },
      })
    ).toThrow();
  });

  it("requires at least one question", () => {
    expect(() =>
      contactContentSchema.parse({
        ...DEFAULT_CONTACT,
        content: {
          ...DEFAULT_CONTACT.content,
          faq: { ...DEFAULT_CONTACT.content.faq, items: [] },
        },
      })
    ).toThrow();
  });

  it("keeps every accent word findable in its title", () => {
    // A word that is not in the title renders plain, which reads as a bug.
    for (const [name, section] of Object.entries(DEFAULT_CONTACT.content)) {
      const { title, accentWord } = section as { title?: string; accentWord?: string };
      if (!title || !accentWord) continue;

      expect(title, name).toContain(accentWord);
    }
  });
});

describe("mergeContactContent", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(mergeContactContent(undefined)).toEqual(DEFAULT_CONTACT.content);
  });

  it("keeps stored fields and fills the rest from defaults", () => {
    const merged = mergeContactContent({ hero: { title: "A Different Way To Reach Us" } });

    expect(merged.hero.title).toBe("A Different Way To Reach Us");
    expect(merged.hero.lead).toBe(DEFAULT_CONTACT.content.hero.lead);
    expect(merged.form).toEqual(DEFAULT_CONTACT.content.form);
  });

  it("ignores section keys it does not recognise", () => {
    const merged = mergeContactContent({ nonsense: { title: "x" } }) as Record<string, unknown>;
    expect(merged.nonsense).toBeUndefined();
  });
});

describe("resolveSections applied to the real Contact section meta", () => {
  it("reproduces the intended surface sequence — the form section shifts off white on purpose", () => {
    const resolved = resolveSections(
      CONTACT_SECTION_META,
      repairLayout(CONTACT_SECTION_IDS, CONTACT_SECTION_META, undefined)
    );

    expect(resolved.map((s) => [s.id, s.surface])).toEqual([
      ["hero", "bg-surface-1"],
      // Position-derived: the form section moves off surface-1 onto a tint
      // — expected and intended per the plan.
      ["form", "bg-surface-2"],
      ["faq", "bg-surface-1"],
      ["visit", "bg-surface-deep"],
    ]);

    expect(resolved.find((s) => s.id === "hero")?.bordered).toBe(false);
    expect(resolved.find((s) => s.id === "form")?.bordered).toBe(true);
    expect(resolved.find((s) => s.id === "visit")?.tone).toBe("dark");
  });

  it("pins the hero to the top no matter what a stored layout says", () => {
    const repaired = repairLayout(CONTACT_SECTION_IDS, CONTACT_SECTION_META, [
      { id: "form", visible: true },
      { id: "hero", visible: false },
    ]);

    expect(repaired[0]).toEqual({ id: "hero", visible: false });
  });
});

describe("membership content schema", () => {
  it("accepts its own defaults", () => {
    expect(() => membershipContentSchema.parse(DEFAULT_MEMBERSHIP)).not.toThrow();
  });

  it("opens with the hero and lists every section exactly once", () => {
    expect(DEFAULT_MEMBERSHIP.layout[0].id).toBe("hero");
    expect(DEFAULT_MEMBERSHIP.layout.map((s) => s.id).sort()).toEqual(
      [...MEMBERSHIP_SECTION_IDS].sort()
    );
  });

  it("keeps all six benefits, not the four the page displays", () => {
    // membership-client.tsx renders benefits.slice(0, 4), but the array has
    // always held six. Storing only the visible four would silently delete
    // two on the first save.
    expect(DEFAULT_MEMBERSHIP.content.benefits.items).toHaveLength(6);
  });

  it("requires at least one benefit", () => {
    expect(() =>
      membershipContentSchema.parse({
        ...DEFAULT_MEMBERSHIP,
        content: {
          ...DEFAULT_MEMBERSHIP.content,
          benefits: { ...DEFAULT_MEMBERSHIP.content.benefits, items: [] },
        },
      })
    ).toThrow();
  });

  it("only accepts icons from the curated set", () => {
    expect(() =>
      membershipContentSchema.parse({
        ...DEFAULT_MEMBERSHIP,
        content: {
          ...DEFAULT_MEMBERSHIP.content,
          benefits: {
            ...DEFAULT_MEMBERSHIP.content.benefits,
            items: [{ icon: "NotAnIcon", title: "x", description: "y" }],
          },
        },
      })
    ).toThrow();
  });

  it("keeps every accent word findable in its title", () => {
    for (const [name, section] of Object.entries(DEFAULT_MEMBERSHIP.content)) {
      const { title, accentWord } = section as { title?: string; accentWord?: string };
      if (!title || !accentWord) continue;

      expect(title, name).toContain(accentWord);
    }
  });
});

describe("mergeMembershipContent", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(mergeMembershipContent(undefined)).toEqual(DEFAULT_MEMBERSHIP.content);
  });

  it("keeps stored fields and fills the rest from defaults", () => {
    const merged = mergeMembershipContent({ plans: { title: "Every Tier, Compared" } });

    expect(merged.plans.title).toBe("Every Tier, Compared");
    expect(merged.plans.lead).toBe(DEFAULT_MEMBERSHIP.content.plans.lead);
    expect(merged.benefits).toEqual(DEFAULT_MEMBERSHIP.content.benefits);
  });

  it("ignores section keys it does not recognise", () => {
    const merged = mergeMembershipContent({ nonsense: { title: "x" } }) as Record<string, unknown>;
    expect(merged.nonsense).toBeUndefined();
  });
});

describe("resolveSections applied to the real Membership section meta", () => {
  it("has no genuine dark closing band today, so every section rotates", () => {
    const resolved = resolveSections(
      MEMBERSHIP_SECTION_META,
      repairLayout(MEMBERSHIP_SECTION_IDS, MEMBERSHIP_SECTION_META, undefined)
    );

    expect(resolved.map((s) => [s.id, s.surface])).toEqual([
      ["hero", "bg-surface-1"],
      ["plans", "bg-surface-2"],
      ["benefits", "bg-surface-1"],
    ]);

    expect(resolved.every((s) => s.tone === "surface")).toBe(true);
    expect(resolved.find((s) => s.id === "plans")?.bordered).toBe(true);
  });

  it("pins the hero to the top no matter what a stored layout says", () => {
    const repaired = repairLayout(MEMBERSHIP_SECTION_IDS, MEMBERSHIP_SECTION_META, [
      { id: "plans", visible: true },
      { id: "hero", visible: false },
    ]);

    expect(repaired[0]).toEqual({ id: "hero", visible: false });
  });
});

describe("listings content", () => {
  it("accepts its own defaults", () => {
    expect(() => listingsContentSchema.parse(DEFAULT_LISTINGS)).not.toThrow();
  });

  it("covers both pages", () => {
    expect(Object.keys(DEFAULT_LISTINGS).sort()).toEqual([
      "eventsCalendar",
      "eventsHero",
      "eventsMembersBand",
      "galleryAlbums",
      "galleryContribute",
      "galleryHero",
    ]);
  });

  it("rejects an empty heading anywhere", () => {
    expect(() =>
      listingsContentSchema.parse({
        ...DEFAULT_LISTINGS,
        galleryHero: { ...DEFAULT_LISTINGS.galleryHero, title: "" },
      })
    ).toThrow();
  });

  it("keeps every accent word findable in its title", () => {
    for (const [name, section] of Object.entries(DEFAULT_LISTINGS)) {
      const { title, accentWord } = section as { title?: string; accentWord?: string };
      if (!title || !accentWord) continue;

      expect(title, name).toContain(accentWord);
    }
  });
});

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

describe("listings content — one document, two pages", () => {
  it("revalidates both pages the document drives", async () => {
    const { PAGE_CONTENT } = await import("@/lib/page-content/registry");

    expect(PAGE_CONTENT.listings.revalidate).toContain("/events");
    expect(PAGE_CONTENT.listings.revalidate).toContain("/gallery");
  });

  it("ships no lead for the albums grid by default", () => {
    // Load-bearing for gallery-landing-client.tsx: the lead only renders
    // when an admin fills it in, and the row layout depends on it staying
    // absent until then.
    expect(DEFAULT_LISTINGS.galleryAlbums.lead).toBe("");
  });
});

/**
 * VERIFICATION NOTE (see task report for the full record): the discriminating
 * power of the fixtures above — "mergePageContent — sectioned pages" and
 * "mergeContactContent"/"mergeMembershipContent" — was checked by temporarily
 * making mergeContactContent/mergeMembershipContent ignore their `stored`
 * argument (returning DEFAULT_*.content unconditionally) and confirming every
 * test naming a distinct fixture value went red, then reverting the change.
 * A fixture whose values equal the defaults would not have caught this.
 */
