"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  InlineSpan,
  LegalBlock,
  parseLegalBody,
} from "@/lib/legal-render";

/**
 * Renders a legal document body.
 *
 * Deliberately not a markdown library and never `dangerouslySetInnerHTML` —
 * the body is parsed into a handful of block types and rendered with the
 * site's own type scale, so legal prose sits in the same voice as the rest of
 * the site and no stored text can ever become markup.
 */

function Spans({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, i) => {
        switch (span.kind) {
          case "bold":
            return (
              <strong key={i} className="font-semibold text-foreground">
                {span.text}
              </strong>
            );

          case "link": {
            const isInternal = span.href.startsWith("/");
            const className =
              "font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary";

            if (isInternal) {
              return (
                <Link key={i} href={span.href} className={className}>
                  {span.text}
                </Link>
              );
            }
            return (
              <a
                key={i}
                href={span.href}
                target={span.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={className}
              >
                {span.text}
              </a>
            );
          }

          case "placeholder":
            // A mandatory detail nobody has filled in yet. Shown loudly rather
            // than silently dropped — an incomplete legal page must not look
            // complete.
            return (
              <span
                key={i}
                title="This detail still needs to be filled in under Admin → Settings → Organisation"
                className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 align-baseline text-[10px] font-bold uppercase tracking-wider text-amber-700"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {span.text}
              </span>
            );

          default:
            return <React.Fragment key={i}>{span.text}</React.Fragment>;
        }
      })}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "heading") {
    return (
      <h3 className="mt-9 mb-3 font-sans text-[15px] font-bold tracking-[-0.02em] text-foreground first:mt-0">
        <Spans spans={block.spans} />
      </h3>
    );
  }

  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag
        className={cn(
          "my-4 space-y-2 pl-5 text-[15px] leading-[1.8] text-muted-foreground",
          block.ordered
            ? "list-decimal marker:font-semibold marker:text-primary/50"
            : "list-disc marker:text-primary/40"
        )}
      >
        {block.items.map((item, i) => (
          <li key={i} className="pl-1">
            <Spans spans={item} />
          </li>
        ))}
      </ListTag>
    );
  }

  return (
    <p className="my-4 text-[15px] leading-[1.85] text-muted-foreground">
      {block.lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          <Spans spans={line} />
        </React.Fragment>
      ))}
    </p>
  );
}

export function LegalBody({ body, className }: { body: string; className?: string }) {
  const blocks = React.useMemo(() => parseLegalBody(body), [body]);

  return (
    <div className={cn("[&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}
