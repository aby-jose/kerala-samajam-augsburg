import { describe, expect, it } from "vitest";
import { isPageSlug, mergePageContent, PAGE_SLUGS } from "@/lib/page-content/registry";

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
