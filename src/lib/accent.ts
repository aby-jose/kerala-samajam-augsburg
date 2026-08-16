/**
 * Split `text` on the first occurrence of `accent`. `match` is empty when the
 * accent is blank or not found, which is the signal to render plain text —
 * admin-entered copy must never crash a page.
 *
 * Kept free of JSX so it can be unit tested under Vitest's node environment;
 * the rendering half lives in components/layout/with-accent.tsx.
 */
export function splitOnAccent(text: string, accent?: string) {
  if (!accent) return { before: text, match: "", after: "" };

  const index = text.indexOf(accent);
  if (index === -1) return { before: text, match: "", after: "" };

  return {
    before: text.slice(0, index),
    match: accent,
    after: text.slice(index + accent.length),
  };
}
