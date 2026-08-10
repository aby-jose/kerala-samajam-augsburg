/**
 * Parsing and placeholder resolution for legal documents.
 *
 * Two jobs, both pure so the admin preview and the public page share them:
 *
 *  1. `resolvePlaceholders` swaps `{{legal.registerNumber}}`-style markers for
 *     the structured facts held in site config. Keeping the register number,
 *     board members and address out of the prose means replacing a treasurer
 *     is a settings edit, not a new document version — and so does not
 *     re-prompt every member for consent.
 *
 *  2. `parseLegalBody` turns "markdown-lite" into a small block list that
 *     legal-body.tsx renders with the site's own typography. The supported
 *     subset is deliberately narrow — headings, paragraphs, bullet and
 *     numbered lists, bold, and links — because that is all a legal document
 *     needs, and it means no HTML is ever stored or injected.
 */

import { SiteConfig } from "./config-schema";
import { LegalContent } from "./legal-schema";

// --- Placeholders --------------------------------------------------------

/** A marker that survived resolution, i.e. a fact nobody has filled in yet. */
export const UNRESOLVED_PATTERN = /\{\{([^}]+)\}\}/g;

function joinNonEmpty(parts: (string | undefined)[], sep: string) {
  return parts.filter((p) => p && p.trim().length > 0).join(sep);
}

/**
 * Values available to documents as `{{key}}`.
 *
 * Anything left unresolved stays visible as `{{…}}` rather than collapsing to
 * an empty string. A legal page that silently omits a mandatory field is far
 * worse than one that loudly shows it is incomplete.
 */
export function buildPlaceholderMap(config: SiteConfig): Record<string, string> {
  const l = config.legal;

  const postalLine = joinNonEmpty([l.postalCode, l.city], " ");
  const fullAddress = joinNonEmpty([l.street, postalLine, l.country], ", ");

  return {
    "legal.entityName": l.entityName,
    "legal.legalForm": l.legalForm,
    "legal.street": l.street,
    "legal.postalCode": l.postalCode,
    "legal.city": l.city,
    "legal.country": l.country,
    "legal.address": fullAddress,
    "legal.addressLines": joinNonEmpty([l.entityName, l.street, postalLine, l.country], "\n"),
    "legal.registerCourt": l.registerCourt,
    "legal.registerNumber": l.registerNumber,
    "legal.register": joinNonEmpty([l.registerCourt, l.registerNumber], ", "),
    "legal.vatId": l.vatId || "—",
    "legal.boardMembers": l.boardMembers.filter(Boolean).join(", "),
    "legal.responsiblePerson": l.responsiblePerson,
    "legal.responsiblePersonAddress": l.responsiblePersonAddress,
    "legal.dpoName": l.dpoName,
    "legal.dpoEmail": l.dpoEmail,
    "legal.supervisoryAuthority": l.supervisoryAuthority,
    "legal.hostingProvider": l.hostingProvider,
    "legal.bankName": l.bankName,
    "legal.iban": l.iban,
    "site.name": config.siteName,
    "site.email": config.contactEmail,
    "site.phone": config.contactPhone || "—",
    "site.address": config.address || fullAddress,
    "site.url": process.env.NEXT_PUBLIC_SITE_URL || "https://ksaugsburg.de",
  };
}

/** Replace every known marker. Unknown ones are left in place, on purpose. */
export function resolvePlaceholders(text: string, map: Record<string, string>): string {
  return text.replace(UNRESOLVED_PATTERN, (whole, key: string) => {
    const value = map[key.trim()];
    if (value === undefined || value === "") return whole;
    return value;
  });
}

export function resolveContent(content: LegalContent, map: Record<string, string>): LegalContent {
  return {
    title: resolvePlaceholders(content.title, map),
    lead: resolvePlaceholders(content.lead, map),
    sections: content.sections.map((s) => ({
      id: s.id,
      heading: resolvePlaceholders(s.heading, map),
      body: resolvePlaceholders(s.body, map),
    })),
  };
}

/**
 * Markers still unresolved after substitution — the facts only the committee
 * knows. The admin editor blocks publishing while any remain.
 */
export function findUnresolvedPlaceholders(
  content: LegalContent,
  map: Record<string, string>
): string[] {
  const resolved = resolveContent(content, map);
  const haystack = [
    resolved.title,
    resolved.lead,
    ...resolved.sections.flatMap((s) => [s.heading, s.body]),
  ].join("\n");

  const found = new Set<string>();
  for (const match of haystack.matchAll(UNRESOLVED_PATTERN)) {
    found.add(match[0]);
  }
  return [...found];
}

// --- markdown-lite -------------------------------------------------------

export type InlineSpan =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "placeholder"; text: string };

/**
 * A paragraph keeps its individual lines rather than collapsing them into one
 * run of text. Legal documents are full of postal addresses and lists of board
 * members where a single newline is meaningful, so soft line breaks are
 * preserved and rendered as `<br>`.
 */
export type LegalBlock =
  | { type: "heading"; spans: InlineSpan[] }
  | { type: "paragraph"; lines: InlineSpan[][] }
  | { type: "list"; ordered: boolean; items: InlineSpan[][] };

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\{\{[^}]+\}\})/g;

/** Split a line into bold / link / placeholder / plain runs. */
export function parseInline(line: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let cursor = 0;

  for (const match of line.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      spans.push({ kind: "text", text: line.slice(cursor, index) });
    }

    const token = match[0];
    if (token.startsWith("**")) {
      spans.push({ kind: "bold", text: token.slice(2, -2) });
    } else if (token.startsWith("{{")) {
      // Survived resolution — render it as a visible "needs filling in" chip
      // rather than letting an incomplete legal page look complete.
      spans.push({ kind: "placeholder", text: token.slice(2, -2).trim() });
    } else {
      const split = token.indexOf("](");
      spans.push({
        kind: "link",
        text: token.slice(1, split),
        href: token.slice(split + 2, -1),
      });
    }
    cursor = index + token.length;
  }

  if (cursor < line.length) {
    spans.push({ kind: "text", text: line.slice(cursor) });
  }
  return spans.length > 0 ? spans : [{ kind: "text", text: line }];
}

const ORDERED_ITEM = /^(\d+)[.)]\s+(.*)$/;

/**
 * Blank line separates blocks. `## ` opens a sub-heading, `- ` a bullet list,
 * `1. ` a numbered list. Everything else is a paragraph, with single newlines
 * inside a paragraph treated as soft wraps.
 */
export function parseLegalBody(body: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const lines = body.replace(/\r\n/g, "\n").split("\n");

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", lines: paragraph.map((line) => parseInline(line)) });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({
      type: "list",
      ordered: list.ordered,
      items: list.items.map((item) => parseInline(item)),
    });
    list = null;
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line === "") {
      flushAll();
      continue;
    }

    if (line.startsWith("## ")) {
      flushAll();
      blocks.push({ type: "heading", spans: parseInline(line.slice(3).trim()) });
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(line.slice(2).trim());
      continue;
    }

    const ordered = line.match(ORDERED_ITEM);
    if (ordered) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[2].trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushAll();
  return blocks;
}

/** Plain-text preview, used for the admin list and search-engine descriptions. */
export function toPlainText(body: string, limit = 160): string {
  const text = body
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[#\-*]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** Slugify a heading into a stable anchor id. */
export function toAnchorId(heading: string, fallback: string): string {
  const slug = heading
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}
