import { z } from "zod";

/**
 * Eyebrow, title, accent word and lead — the block every section on every one
 * of these pages repeats. Spread into a section schema rather than nested, so
 * a field path stays `hero.title` instead of `hero.heading.title` and the
 * editors stay flat.
 *
 * Mirrors `headingFields` in home-schema.ts. Not shared with it on purpose:
 * the home document is its own model with its own migration history, and
 * coupling the two would mean a limit change on one page silently retuning
 * validation on the other.
 */
export const sectionHeadingFields = {
  eyebrow: z.string().min(1, "Required").max(60),
  title: z.string().min(1, "Required").max(160),
  // Must appear inside `title` verbatim; rendered in the serif italic accent.
  // Plain text when blank or not found — see lib/accent.ts.
  accentWord: z.string().max(60).optional().or(z.literal("")),
  lead: z.string().min(1, "Required").max(500),
};

export interface InlineNode {
  text: string;
  href?: string;
}

/** `[label](/href)` — the only markup admin-entered prose supports. */
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Split a sentence into plain runs and link runs.
 *
 * The contact FAQ answers had their links written as JSX, so moving the copy
 * into the database would have flattened them into plain text. This is the
 * smallest syntax that keeps them: no bold, no lists, nothing that lets an
 * administrator break the page's typography.
 *
 * Anything that does not match is returned as literal text. A stray bracket
 * must render as a stray bracket — never swallow a sentence because someone
 * typed one.
 */
export function parseInlineLinks(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(LINK)) {
    const start = match.index ?? 0;

    if (start > cursor) nodes.push({ text: text.slice(cursor, start) });
    nodes.push({ text: match[1], href: match[2] });

    cursor = start + match[0].length;
  }

  if (cursor < text.length) nodes.push({ text: text.slice(cursor) });

  return nodes.length ? nodes : [{ text }];
}
