/**
 * Invariants over every email template.
 *
 * The suite enumerates `templates` at runtime rather than a hand-written list,
 * so a template file added later cannot escape it. That is not hypothetical:
 * `staff.ts` was added mid-project and went unnoticed by a survey that counted
 * seven files.
 *
 * Everything here is pure — no database, no network. `testContext()` is built
 * from `defaultConfig`, so a failure means a template changed, never that Mongo
 * was unreachable.
 */

import { describe, expect, it } from "vitest";

import { FIXTURES, allTemplateKeys, testContext } from "../scripts/email-fixtures";
import { MAX_SECTIONS, renderMessage } from "../src/lib/email/shell";
import { buildTheme } from "../src/lib/email/tokens";

const ctx = testContext();
const t = buildTheme(ctx.branding);

/**
 * Colours that are not derived from the brand.
 *
 * The neutral ramp, the closing band's palette, and the one hard-coded grey in
 * the footer copyright line. Anything outside this set and the derived set is a
 * stray hue — the check is run over the *rendered* output rather than the
 * source, because that is the only place a colour can actually reach a reader.
 */
const NEUTRALS = new Set([
  // Light ramp
  "#1c1a19", "#55504c", "#78716c", "#eae7e4", "#f4f2f0", "#ffffff", "#faf8f7",
  // Closing band
  "#0f0f0f", "#9f9f9f", "#6f6f6f", "#262626", "#333333", "#1d1d1d", "#a8a09a",
]);

/**
 * Every colour a reader can actually see, lowercased and deduplicated.
 *
 * Ordinary HTML comments are dropped first. The shell carries a comment
 * explaining the dark-mode bug this design replaced, and it quotes the two hex
 * values involved — text that no mail client renders, but that a naive scan
 * reports as a stray hue.
 *
 * Conditional comments are deliberately *kept*. `<!--[if mso]>` wraps the VML
 * button, whose `fillcolor` and `strokecolor` are real colours in Outlook —
 * the one client where the fallback matters most. Stripping every comment
 * would blind this check to exactly the markup hardest to eyeball.
 */
function visibleColours(html: string): Set<string> {
  const rendered = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, "");
  return new Set(
    [...rendered.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toLowerCase())
  );
}

describe("email templates", () => {
  it("every exported template has a fixture", () => {
    const covered = new Set(FIXTURES.map((f) => `${f.group}/${f.name}`));
    const missing = allTemplateKeys().filter((key) => !covered.has(key));
    expect(missing).toEqual([]);
  });

  it("every fixture points at a template that exists", () => {
    const known = new Set(allTemplateKeys());
    const dangling = FIXTURES.map((f) => `${f.group}/${f.name}`).filter((k) => !known.has(k));
    expect(dangling).toEqual([]);
  });

  for (const fixture of FIXTURES) {
    describe(`${fixture.group}/${fixture.name}`, () => {
      const doc = fixture.build(ctx);
      const html = renderMessage(ctx, doc);

      it("renders with all four inbox-facing fields", () => {
        expect(html).toContain("<html");
        expect(doc.subject.trim()).not.toBe("");
        expect(doc.previewText.trim()).not.toBe("");
        expect(doc.eyebrow.trim()).not.toBe("");
        expect(doc.title.trim()).not.toBe("");
      });

      it("uses only derived or neutral colours", () => {
        const derived = new Set(
          [
            t.primary, t.primaryDeep, t.primaryTint, t.primaryEdge,
            t.bandA, t.bandB, t.onPrimary,
          ].map((c) => c.toLowerCase())
        );
        const stray = [...visibleColours(html)].filter(
          (c) => !derived.has(c) && !NEUTRALS.has(c)
        );

        expect(stray).toEqual([]);
      });

      it("has an accent word occurring verbatim in the title", () => {
        expect(doc.accentWord).toBeTruthy();
        expect(doc.title).toContain(doc.accentWord as string);
      });

      it(`carries at most ${MAX_SECTIONS} section panels`, () => {
        expect(doc.sections.length).toBeLessThanOrEqual(MAX_SECTIONS);
      });

      it("declares light-only and ships no dark-mode rule", () => {
        expect(html).toContain('name="color-scheme" content="light"');
        expect(html).not.toContain("@media (prefers-color-scheme");
      });
    });
  }
});
