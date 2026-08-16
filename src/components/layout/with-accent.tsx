import { splitOnAccent } from "@/lib/accent";
import { Accent } from "@/components/layout/section-heading";

/** Wraps the accent slice of `text` in <Accent>, falling back to plain text
 *  when the accent word is blank or absent. */
export function withAccent(text: string, accent?: string) {
  const { before, match, after } = splitOnAccent(text, accent);
  if (!match) return text;

  return (
    <>
      {before}
      <Accent>{match}</Accent>
      {after}
    </>
  );
}
