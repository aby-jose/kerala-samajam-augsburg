import Link from "next/link";

import { parseInlineLinks } from "@/lib/page-content/section";
import { cn } from "@/lib/utils";

/**
 * Renders admin-entered prose, turning `[label](/href)` into a link. The
 * pure splitter lives in lib/page-content/section.ts so it can be unit tested
 * under Vitest's node environment.
 */
export function InlineLinks({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {parseInlineLinks(text).map((node, i) =>
        node.href ? (
          <Link
            key={i}
            href={node.href}
            className={cn(
              "font-semibold text-foreground underline decoration-border decoration-1 underline-offset-4 transition-colors duration-300 hover:text-primary hover:decoration-primary",
              className
            )}
          >
            {node.text}
          </Link>
        ) : (
          <span key={i}>{node.text}</span>
        )
      )}
    </>
  );
}
