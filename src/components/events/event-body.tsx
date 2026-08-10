"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  parseLegalBody,
  type InlineSpan,
  type LegalBlock,
} from "@/lib/legal-render";

/**
 * Renders an event description.
 *
 * Descriptions are written in the admin as light markdown — bold runs, blank
 * lines between paragraphs, `* ` bullets — and were previously printed raw, so
 * every asterisk showed on the page. This reuses the block parser the legal
 * pages already use (never a markdown dependency, never
 * `dangerouslySetInnerHTML`, so no stored text can become markup) and gives it
 * the event page's own type scale.
 *
 * The two shapes that show up in practice get special treatment:
 *   - a lone bold line at the top is the strapline, so it opens as a lead;
 *   - `* **Onasadya:** a feast of…` is a titled row, not a bullet with a bold
 *     word stuck to the front of it.
 */

function Spans({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, i) => {
        if (span.kind === "bold") {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {span.text}
            </strong>
          );
        }

        if (span.kind === "link") {
          const className =
            "font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors duration-300 hover:decoration-primary";

          return span.href.startsWith("/") ? (
            <Link key={i} href={span.href} className={className}>
              {span.text}
            </Link>
          ) : (
            <a
              key={i}
              href={span.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {span.text}
            </a>
          );
        }

        // Placeholders are a legal-page concern; here the raw text is fine.
        return <React.Fragment key={i}>{span.text}</React.Fragment>;
      })}
    </>
  );
}

/** Drop the colon or dash left stranded at the front of a split list item. */
function trimLeadingSeparator(spans: InlineSpan[]): InlineSpan[] {
  const [head, ...tail] = spans;
  if (!head || head.kind !== "text") return spans;

  const text = head.text.replace(/^\s*[:–—-]?\s*/, "");
  return text ? [{ kind: "text", text }, ...tail] : tail;
}

/** `**Authentic Onasadya:** Indulge in…` → a title and a body. */
function splitTitledItem(item: InlineSpan[]) {
  const [head, ...tail] = item;
  if (!head || head.kind !== "bold") return null;

  return {
    title: head.text.replace(/\s*[:–—-]\s*$/, ""),
    body: trimLeadingSeparator(tail),
  };
}

/** A block that is nothing but one bold line — the strapline under the title. */
function leadText(block: LegalBlock | undefined): string | null {
  if (!block || block.type !== "paragraph" || block.lines.length !== 1) {
    return null;
  }

  const [span, ...rest] = block.lines[0];
  if (rest.length > 0 || !span || span.kind !== "bold") return null;

  return span.text;
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "heading") {
    return (
      <h3 className="mb-4 mt-10 font-sans text-[17px] font-bold tracking-[-0.02em] text-foreground first:mt-0">
        <Spans spans={block.spans} />
      </h3>
    );
  }

  if (block.type === "list") {
    return (
      <ul className="my-7 border-t border-border">
        {block.items.map((item, i) => {
          const titled = splitTitledItem(item);

          return (
            <li
              key={i}
              className="flex gap-4 border-b border-border py-4 sm:gap-5"
            >
              <span
                aria-hidden
                className={cn(
                  "shrink-0",
                  block.ordered
                    ? "pt-0.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground/50"
                    : "mt-2.5 h-1.5 w-1.5 rounded-full bg-primary/70"
                )}
              >
                {block.ordered ? String(i + 1).padStart(2, "0") : null}
              </span>

              <div className="min-w-0">
                {titled ? (
                  <>
                    <p className="font-sans text-[15px] font-bold tracking-[-0.015em] text-foreground">
                      {titled.title}
                    </p>
                    {titled.body.length > 0 && (
                      <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                        <Spans spans={titled.body} />
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[15px] leading-relaxed text-muted-foreground">
                    <Spans spans={item} />
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <p className="my-4 text-[15px] leading-[1.8] text-muted-foreground md:text-base">
      {block.lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          <Spans spans={line} />
        </React.Fragment>
      ))}
    </p>
  );
}

export function EventBody({
  body,
  className,
}: {
  body: string;
  className?: string;
}) {
  const blocks = React.useMemo(() => parseLegalBody(body ?? ""), [body]);

  const lead = leadText(blocks[0]);
  const rest = lead ? blocks.slice(1) : blocks;

  return (
    <div
      className={cn(
        // Descriptions are pasted in, so a stray URL or a long German compound
        // must wrap rather than push the page sideways on a phone.
        "break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      {lead && (
        <p className="mb-7 font-sans text-lg font-bold leading-snug tracking-[-0.02em] text-foreground md:text-xl">
          {lead}
        </p>
      )}

      {rest.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}
