import { describe, expect, it } from "vitest";
import {
  isLegacyPageContent,
  isPageSlug,
  mergePageContent,
  PAGE_SLUGS,
} from "@/lib/page-content/registry";
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
import {
  DEFAULT_EVENTS,
  eventsContentSchema,
  EVENTS_SECTION_IDS,
  mergeEventsContent,
} from "@/lib/page-content/events";
import { EVENTS_SECTION_META } from "@/lib/page-content/events-sections";
import {
  DEFAULT_GALLERY,
  galleryContentSchema,
  GALLERY_SECTION_IDS,
  mergeGalleryContent,
} from "@/lib/page-content/gallery";
import { GALLERY_SECTION_META } from "@/lib/page-content/gallery-sections";
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

  it("no longer recognises the old flat listings slug", () => {
    // listings split into events and gallery — see events.ts/gallery.ts.
    expect(isPageSlug("listings")).toBe(false);
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
 * THE DISCRIMINATING FIXTURES. Every value below is deliberately DIFFERENT
 * from DEFAULT_CONTACT / DEFAULT_MEMBERSHIP / DEFAULT_EVENTS / DEFAULT_GALLERY
 * — not a transcription of them. If a fixture's values coincided with the
 * defaults, a merge that discarded the stored document and fell back to
 * defaults would make every assertion below pass anyway, and the test would
 * prove nothing. See the file-level verification note at the bottom of this
 * file for how this was checked.
 *
 * Every page registered today (contact, membership, events, gallery) is
 * sectioned — see registry.ts's FlatPageEntry comment for why the flat
 * branch of mergePageContent() has no fixture here: there is no flat slug
 * left to exercise it through the registry.
 */
describe("mergePageContent — sectioned pages (contact, membership, events, gallery)", () => {
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

    // hero is pinned AND non-hideable — a stored `visible: false` on it is
    // forced back to true, the same enforcement repairLayout's position pin
    // gets, just applied to visibility instead of order.
    expect(merged.layout[0]).toEqual({ id: "hero", visible: true });
    expect(merged.content.plans.title).toBe("Choose Your Tier");
    expect(merged.content.benefits).toEqual(DEFAULT_MEMBERSHIP.content.benefits);
  });

  it("repairs layout and merges content for a stored events document", () => {
    const merged = mergePageContent("events", {
      layout: [
        { id: "membersBand", visible: false },
        { id: "hero", visible: true },
        { id: "calendar", visible: true },
      ],
      content: {
        hero: { title: "This Season's Gatherings" },
      },
    }) as { layout: { id: string; visible: boolean }[]; content: Record<string, Record<string, unknown>> };

    // hero is pinned to the top regardless of what the stored layout says.
    expect(merged.layout[0]).toEqual({ id: "hero", visible: true });
    expect(merged.layout.find((s) => s.id === "membersBand")).toEqual({
      id: "membersBand",
      visible: false,
    });

    expect(merged.content.hero.title).toBe("This Season's Gatherings");
    // Sibling fields inside the edited section survive from defaults.
    expect(merged.content.hero.lead).toBe(DEFAULT_EVENTS.content.hero.lead);
    // Untouched sections come through whole.
    expect(merged.content.membersBand).toEqual(DEFAULT_EVENTS.content.membersBand);
  });

  it("repairs layout and merges content for a stored gallery document", () => {
    const merged = mergePageContent("gallery", {
      layout: [
        { id: "contribute", visible: true },
        { id: "hero", visible: false },
        { id: "albums", visible: true },
      ],
      content: {
        albums: { title: "Every Album We Have" },
      },
    }) as { layout: { id: string; visible: boolean }[]; content: Record<string, Record<string, unknown>> };

    // hero is pinned AND non-hideable — a stored `visible: false` on it is
    // forced back to true, the same enforcement repairLayout's position pin
    // gets, just applied to visibility instead of order.
    expect(merged.layout[0]).toEqual({ id: "hero", visible: true });
    expect(merged.content.albums.title).toBe("Every Album We Have");
    // Sibling fields inside the edited section survive from defaults.
    expect(merged.content.albums.eyebrow).toBe(DEFAULT_GALLERY.content.albums.eyebrow);
    // Untouched sections come through whole.
    expect(merged.content.hero).toEqual(DEFAULT_GALLERY.content.hero);
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

describe("isLegacyPageContent", () => {
  it("is true for an empty object (no layout, no content — degrades to defaults either way)", () => {
    expect(isLegacyPageContent({})).toBe(true);
  });

  it("is true for a flat pre-migration document — no `layout` key, no `content` key", () => {
    // The exact shape of Contact's one row as it exists on `main` today —
    // git show 2243c9c:src/lib/page-content/contact.ts.
    expect(isLegacyPageContent({ hero: {}, form: {}, faq: {}, visit: {} })).toBe(true);
  });

  it("is false for a document with `content` but no `layout`", () => {
    // Not legacy, just a partial new-shape document — mergePageContent's
    // normal branch already tolerates a missing `layout` on its own.
    expect(isLegacyPageContent({ content: { hero: {} } })).toBe(false);
  });

  it("is false for a document with `layout` but no `content`", () => {
    expect(isLegacyPageContent({ layout: [{ id: "hero", visible: true }] })).toBe(false);
  });

  it("is false for a genuine new-shape document — must not be mistaken for legacy", () => {
    expect(
      isLegacyPageContent({ layout: [{ id: "hero", visible: true }], content: { hero: {} } })
    ).toBe(false);
  });

  it("is false for undefined, null, and an array — none of these are a flat legacy object", () => {
    expect(isLegacyPageContent(undefined)).toBe(false);
    expect(isLegacyPageContent(null)).toBe(false);
    expect(isLegacyPageContent([])).toBe(false);
  });
});

/**
 * THE LEGACY-SHAPE FIXTURE. Every value below is deliberately DIFFERENT from
 * DEFAULT_CONTACT — not a transcription of it — for the same reason the
 * discriminating fixtures above are: a fixture that coincided with the
 * defaults would pass whether mergePageContent() actually lifted the stored
 * document or silently discarded it and fell back to defaults. See the
 * file-level verification note at the bottom of this file for how this was
 * checked.
 *
 * This is the shape a real stored PageContent row has today if `main` is
 * deployed anywhere and an administrator has ever pressed Save on the old
 * Contact editor: no `layout`, no `content` — the document's own top-level
 * keys (`hero`, `form`, `faq`, `visit`) ARE the content, one key per section
 * id. See git show 2243c9c:src/lib/page-content/contact.ts.
 */
const LEGACY_CONTACT_DOCUMENT = {
  hero: {
    eyebrow: "Reach us",
    title: "Write To The Committee",
    accentWord: "Committee",
    lead: "This lead exists only in the legacy fixture and matches nothing in DEFAULT_CONTACT, so its survival through the lift is a real assertion.",
  },
  form: {
    eyebrow: "Send word",
    title: "Tell Us What You Need",
    accentWord: "Need",
    lead: "A distinct legacy lead for the form section, matching no default copy.",
  },
  faq: {
    eyebrow: "Common questions",
    title: "What People Ask",
    accentWord: "Ask",
    lead: "A distinct legacy lead for the faq section.",
    items: [
      { question: "Legacy question one?", answer: "Legacy answer one." },
      { question: "Legacy question two?", answer: "Legacy answer two." },
    ],
  },
  visit: {
    eyebrow: "Just visit",
    title: "Or Walk Right In",
    accentWord: "Walk Right In",
    lead: "A distinct legacy lead for the visit section.",
  },
};

describe("mergePageContent — legacy flat documents (pre-migration shape)", () => {
  it("lifts a legacy flat Contact document instead of discarding it as unrecognised", () => {
    const merged = mergePageContent("contact", LEGACY_CONTACT_DOCUMENT) as {
      layout: { id: string; visible: boolean }[];
      content: Record<string, Record<string, unknown>>;
    };

    // Every stored field survives, lifted into the new {layout, content}
    // shape — none of this coincides with DEFAULT_CONTACT, so a merge that
    // fell back to defaults instead of lifting would fail every line below.
    expect(merged.content.hero.title).toBe("Write To The Committee");
    expect(merged.content.hero.lead).toBe(LEGACY_CONTACT_DOCUMENT.hero.lead);
    expect(merged.content.form.title).toBe("Tell Us What You Need");
    expect(merged.content.faq.items).toEqual(LEGACY_CONTACT_DOCUMENT.faq.items);
    expect(merged.content.visit.title).toBe("Or Walk Right In");

    // A legacy document never had a layout — falls back to the default
    // order, hero pinned first, everything visible.
    expect(merged.layout.map((s) => s.id)).toEqual([...CONTACT_SECTION_IDS]);
    expect(merged.layout.every((s) => s.visible)).toBe(true);

    // What mergePageContent produces must still satisfy the page's own
    // schema — the read path hands this straight to the public page.
    expect(() => contactContentSchema.parse(merged)).not.toThrow();
  });

  it("a legacy document with no recognised keys at all still yields the full default shape", () => {
    // {} has neither `layout` nor `content` — isLegacyPageContent treats it
    // as legacy, and lifting an object with no matching section keys
    // degrades to exactly the same defaults an empty stored document
    // already produced before this fix.
    const merged = mergePageContent("contact", {}) as { content: unknown };
    expect(merged.content).toEqual(DEFAULT_CONTACT.content);
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
    // An administrator typing a bracket must never make their sentence vanish.
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

describe("events content schema", () => {
  it("accepts its own defaults", () => {
    expect(() => eventsContentSchema.parse(DEFAULT_EVENTS)).not.toThrow();
  });

  it("opens with the hero and lists every section exactly once", () => {
    expect(DEFAULT_EVENTS.layout[0].id).toBe("hero");
    expect(DEFAULT_EVENTS.layout.map((s) => s.id).sort()).toEqual([...EVENTS_SECTION_IDS].sort());
  });

  it("rejects an empty title anywhere", () => {
    expect(() =>
      eventsContentSchema.parse({
        ...DEFAULT_EVENTS,
        content: {
          ...DEFAULT_EVENTS.content,
          calendar: { ...DEFAULT_EVENTS.content.calendar, title: "" },
        },
      })
    ).toThrow();
  });

  it("keeps every accent word findable in its title", () => {
    for (const [name, section] of Object.entries(DEFAULT_EVENTS.content)) {
      const { title, accentWord } = section as { title?: string; accentWord?: string };
      if (!title || !accentWord) continue;

      expect(title, name).toContain(accentWord);
    }
  });
});

describe("mergeEventsContent", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(mergeEventsContent(undefined)).toEqual(DEFAULT_EVENTS.content);
  });

  it("keeps stored fields and fills the rest from defaults", () => {
    const merged = mergeEventsContent({ calendar: { title: "Every Date We Have" } });

    expect(merged.calendar.title).toBe("Every Date We Have");
    expect(merged.calendar.lead).toBe(DEFAULT_EVENTS.content.calendar.lead);
    expect(merged.hero).toEqual(DEFAULT_EVENTS.content.hero);
  });

  it("ignores section keys it does not recognise", () => {
    const merged = mergeEventsContent({ nonsense: { title: "x" } }) as Record<string, unknown>;
    expect(merged.nonsense).toBeUndefined();
  });
});

describe("resolveSections applied to the real Events section meta", () => {
  it("reproduces the intended surface sequence, matching the pre-split page exactly at the default order", () => {
    const resolved = resolveSections(
      EVENTS_SECTION_META,
      repairLayout(EVENTS_SECTION_IDS, EVENTS_SECTION_META, undefined)
    );

    expect(resolved.map((s) => [s.id, s.surface])).toEqual([
      ["hero", "bg-surface-1"],
      ["calendar", "bg-surface-2"],
      ["membersBand", "bg-surface-deep"],
    ]);

    expect(resolved.find((s) => s.id === "hero")?.bordered).toBe(false);
    expect(resolved.find((s) => s.id === "calendar")?.bordered).toBe(true);
    expect(resolved.find((s) => s.id === "membersBand")?.tone).toBe("dark");
  });

  it("pins the hero to the top no matter what a stored layout says", () => {
    const repaired = repairLayout(EVENTS_SECTION_IDS, EVENTS_SECTION_META, [
      { id: "calendar", visible: true },
      { id: "hero", visible: false },
    ]);

    expect(repaired[0]).toEqual({ id: "hero", visible: false });
  });
});

describe("gallery content schema", () => {
  it("accepts its own defaults", () => {
    expect(() => galleryContentSchema.parse(DEFAULT_GALLERY)).not.toThrow();
  });

  it("opens with the hero and lists every section exactly once", () => {
    expect(DEFAULT_GALLERY.layout[0].id).toBe("hero");
    expect(DEFAULT_GALLERY.layout.map((s) => s.id).sort()).toEqual([...GALLERY_SECTION_IDS].sort());
  });

  it("ships no lead for the albums grid by default", () => {
    // Load-bearing for gallery-landing-client.tsx: the lead only renders
    // when an admin fills it in, and the row layout depends on it staying
    // absent until then.
    expect(DEFAULT_GALLERY.content.albums.lead).toBe("");
  });

  it("accepts an empty or missing lead on the albums section", () => {
    expect(() =>
      galleryContentSchema.parse({
        ...DEFAULT_GALLERY,
        content: { ...DEFAULT_GALLERY.content, albums: { ...DEFAULT_GALLERY.content.albums, lead: "" } },
      })
    ).not.toThrow();
  });

  it("rejects an empty title anywhere", () => {
    expect(() =>
      galleryContentSchema.parse({
        ...DEFAULT_GALLERY,
        content: {
          ...DEFAULT_GALLERY.content,
          hero: { ...DEFAULT_GALLERY.content.hero, title: "" },
        },
      })
    ).toThrow();
  });

  it("keeps every accent word findable in its title", () => {
    for (const [name, section] of Object.entries(DEFAULT_GALLERY.content)) {
      const { title, accentWord } = section as { title?: string; accentWord?: string };
      if (!title || !accentWord) continue;

      expect(title, name).toContain(accentWord);
    }
  });
});

describe("mergeGalleryContent", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(mergeGalleryContent(undefined)).toEqual(DEFAULT_GALLERY.content);
  });

  it("keeps stored fields and fills the rest from defaults", () => {
    const merged = mergeGalleryContent({ contribute: { title: "Send Us What You Took" } });

    expect(merged.contribute.title).toBe("Send Us What You Took");
    expect(merged.contribute.lead).toBe(DEFAULT_GALLERY.content.contribute.lead);
    expect(merged.hero).toEqual(DEFAULT_GALLERY.content.hero);
  });

  it("ignores section keys it does not recognise", () => {
    const merged = mergeGalleryContent({ nonsense: { title: "x" } }) as Record<string, unknown>;
    expect(merged.nonsense).toBeUndefined();
  });
});

describe("resolveSections applied to the real Gallery section meta", () => {
  it("reproduces the intended surface sequence, matching the pre-split page exactly at the default order", () => {
    const resolved = resolveSections(
      GALLERY_SECTION_META,
      repairLayout(GALLERY_SECTION_IDS, GALLERY_SECTION_META, undefined)
    );

    expect(resolved.map((s) => [s.id, s.surface])).toEqual([
      ["hero", "bg-surface-1"],
      ["albums", "bg-surface-2"],
      ["contribute", "bg-surface-deep"],
    ]);

    expect(resolved.find((s) => s.id === "hero")?.bordered).toBe(false);
    expect(resolved.find((s) => s.id === "albums")?.bordered).toBe(true);
    expect(resolved.find((s) => s.id === "contribute")?.tone).toBe("dark");
  });

  it("pins the hero to the top no matter what a stored layout says", () => {
    const repaired = repairLayout(GALLERY_SECTION_IDS, GALLERY_SECTION_META, [
      { id: "albums", visible: true },
      { id: "hero", visible: false },
    ]);

    expect(repaired[0]).toEqual({ id: "hero", visible: false });
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

/**
 * VERIFICATION NOTE (see task report for the full record): the discriminating
 * power of the fixtures above — "mergePageContent — sectioned pages" and
 * "mergeContactContent"/"mergeMembershipContent"/"mergeEventsContent"/
 * "mergeGalleryContent" — was checked by temporarily making each merge*Content
 * function ignore its `stored` argument (returning DEFAULT_*.content
 * unconditionally) and confirming every test naming a distinct fixture value
 * went red, then reverting the change. A fixture whose values equal the
 * defaults would not have caught this.
 *
 * The same check was repeated for "mergePageContent — legacy flat documents":
 * mergePageContent's legacy branch was temporarily changed to discard
 * `stored` and fall through to the normal branch's defaults-only behaviour
 * (as if `isLegacyPageContent` always returned false), confirming the legacy
 * document's test went red, then reverted. See the task report for exactly
 * which assertions failed.
 */
