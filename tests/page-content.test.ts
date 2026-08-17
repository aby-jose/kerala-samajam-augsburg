import { describe, expect, it } from "vitest";
import { isPageSlug, mergePageContent, PAGE_SLUGS } from "@/lib/page-content/registry";
import { parseInlineLinks } from "@/lib/page-content/section";
import { contactContentSchema, DEFAULT_CONTACT } from "@/lib/page-content/contact";
import { DEFAULT_MEMBERSHIP, membershipContentSchema } from "@/lib/page-content/membership";
import { DEFAULT_LISTINGS, listingsContentSchema } from "@/lib/page-content/listings";
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

describe("mergePageContent", () => {
  const slug = PAGE_SLUGS[0];

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

describe("contact content", () => {
  it("accepts its own defaults", () => {
    expect(() => contactContentSchema.parse(DEFAULT_CONTACT)).not.toThrow();
  });

  it("ships the four questions the page answers today", () => {
    expect(DEFAULT_CONTACT.faq.items).toHaveLength(4);
  });

  it("rejects an empty title", () => {
    expect(() =>
      contactContentSchema.parse({
        ...DEFAULT_CONTACT,
        hero: { ...DEFAULT_CONTACT.hero, title: "" },
      })
    ).toThrow();
  });

  it("requires at least one question", () => {
    expect(() =>
      contactContentSchema.parse({
        ...DEFAULT_CONTACT,
        faq: { ...DEFAULT_CONTACT.faq, items: [] },
      })
    ).toThrow();
  });

  it("keeps every accent word findable in its title", () => {
    // A word that is not in the title renders plain, which reads as a bug.
    for (const [name, section] of Object.entries(DEFAULT_CONTACT)) {
      const { title, accentWord } = section as { title?: string; accentWord?: string };
      if (!title || !accentWord) continue;

      expect(title, name).toContain(accentWord);
    }
  });
});

describe("membership content", () => {
  it("accepts its own defaults", () => {
    expect(() => membershipContentSchema.parse(DEFAULT_MEMBERSHIP)).not.toThrow();
  });

  it("keeps all six benefits, not the four the page displays", () => {
    // membership-client.tsx renders benefits.slice(0, 4), but the array has
    // always held six. Storing only the visible four would silently delete
    // two on the first save.
    expect(DEFAULT_MEMBERSHIP.benefits.items).toHaveLength(6);
  });

  it("requires at least one benefit", () => {
    expect(() =>
      membershipContentSchema.parse({
        ...DEFAULT_MEMBERSHIP,
        benefits: { ...DEFAULT_MEMBERSHIP.benefits, items: [] },
      })
    ).toThrow();
  });

  it("only accepts icons from the curated set", () => {
    expect(() =>
      membershipContentSchema.parse({
        ...DEFAULT_MEMBERSHIP,
        benefits: {
          ...DEFAULT_MEMBERSHIP.benefits,
          items: [{ icon: "NotAnIcon", title: "x", description: "y" }],
        },
      })
    ).toThrow();
  });

  it("keeps every accent word findable in its title", () => {
    for (const [name, section] of Object.entries(DEFAULT_MEMBERSHIP)) {
      const { title, accentWord } = section as { title?: string; accentWord?: string };
      if (!title || !accentWord) continue;

      expect(title, name).toContain(accentWord);
    }
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

describe("mergePageContent — empty stored array falls back to defaults", () => {
  it("restores the default list when a stored section's array is empty", () => {
    const merged = mergePageContent("contact", {
      faq: { ...DEFAULT_CONTACT.faq, items: [] },
    }) as { faq: { items: unknown[] } };

    expect(merged.faq.items).toEqual(DEFAULT_CONTACT.faq.items);
  });

  it("restores the default list when the stored value is not an array", () => {
    const merged = mergePageContent("membership", {
      benefits: { ...DEFAULT_MEMBERSHIP.benefits, items: "not an array" as unknown as never },
    }) as { benefits: { items: unknown[] } };

    expect(merged.benefits.items).toEqual(DEFAULT_MEMBERSHIP.benefits.items);
  });
});
