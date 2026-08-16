import { describe, expect, it } from "vitest";
import { isPageSlug, mergePageContent, PAGE_SLUGS } from "@/lib/page-content/registry";
import { parseInlineLinks } from "@/lib/page-content/section";

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
