/**
 * The block vocabulary every template is composed from.
 *
 * Three constraints shape all of it:
 *
 * 1. **Tables, not divs.** Outlook on Windows renders mail through the Word
 *    engine. It ignores `max-width` on a `div`, drops `border-radius` and
 *    `box-shadow`, and does unpredictable things with margins. A nested
 *    `<table role="presentation">` is the only layout primitive that behaves
 *    the same in Outlook 2016 and in iOS Mail.
 *
 * 2. **Inline styles, not classes.** Gmail keeps a `<style>` block in most
 *    cases but strips it when a message is forwarded or clipped, and several
 *    corporate filters remove it outright. Anything that matters is inline;
 *    the head stylesheet only carries progressive enhancement — media queries
 *    and hover states, which cannot be inlined.
 *
 * 3. **One spacing scale.** Blocks own their internal padding and nothing
 *    else; the vertical gap between them is decided by `stack()` in the
 *    layout. A component that sets its own outer margin cannot be rearranged
 *    without the rhythm falling apart, which is what went wrong the first
 *    time.
 */

import { SPACE, type EmailTheme } from "./tokens";

/**
 * Escape a value before it goes into email HTML.
 *
 * Names, subjects, album titles and contact messages all reach these templates
 * straight from a form. Unescaped, a sender could put markup — a link, a
 * styled block impersonating the committee — into the notification an
 * administrator reads. Not browser XSS, since mail clients do not run scripts,
 * but it is still attacker-controlled content rendered as markup to staff.
 */
export const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Escape for a URL used as an `href`.
 *
 * `esc` alone is not enough: a value that survives HTML escaping can still
 * carry a `javascript:` scheme. Anything that is not plainly http(s), mailto
 * or tel is dropped to `#`.
 */
export const escUrl = (url: unknown): string => {
  const raw = String(url ?? "").trim();
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(raw)) return "#";
  return esc(raw);
};

/**
 * How much weight a block carries — not what colour it is.
 *
 * The names are kept because they say something true about the message, and
 * they drive the eyebrow wording and the emphasis. They do **not** drive hue:
 * everything resolves to either the association's own brand colour or a
 * neutral. A transactional email that mixes in amber, teal and red stops
 * looking like it came from this association, and since the brand colour is
 * configurable, any fixed status palette will eventually clash with whatever
 * an administrator sets.
 *
 * Urgency is carried by the words — "SECURITY NOTICE", "EVENT CANCELLED" —
 * and by whether a block is accented or plain.
 */
export type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

export interface ToneColors {
  bg: string;
  border: string;
  fg: string;
  bar: string;
}

/** Anything that is not explicitly routine gets the accent treatment. */
const ACCENTED: ReadonlySet<Tone> = new Set(["brand", "success", "warning", "danger"]);

export const toneColors = (t: EmailTheme, tone: Tone): ToneColors =>
  ACCENTED.has(tone)
    ? { bg: t.primaryTint, border: t.primaryEdge, fg: t.primaryDeep, bar: t.primary }
    : { bg: t.surfaceAlt, border: t.hairline, fg: t.muted, bar: t.muted };

// --- Vertical rhythm --------------------------------------------------------

/**
 * Stack blocks with one consistent gap.
 *
 * This is what replaced per-component margins. Each entry becomes a table row,
 * so the spacing is a real cell rather than a margin — which Outlook collapses
 * unpredictably — and empty entries vanish instead of leaving a hole.
 */
export const stack = (blocks: (string | null | undefined | false)[], gap: number = SPACE.lg): string => {
  const visible = blocks.filter((b): b is string => !!b && b.trim() !== "");
  if (!visible.length) return "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${visible
    .map(
      (block, i) =>
        `<tr><td style="padding-top:${i === 0 ? 0 : gap}px;">${block}</td></tr>`
    )
    .join("")}</table>`;
};

export const divider = (t: EmailTheme): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;line-height:1px;font-size:0;background-color:${t.hairline};">&nbsp;</td></tr></table>`;

export const spacer = (height: number): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</td></tr></table>`;

// --- Typography -------------------------------------------------------------

/**
 * The small tracked label above a headline.
 *
 * It is the fastest thing in the message to read, and it is what tells someone
 * scanning their inbox whether this is a ticket, a receipt or a security
 * notice before they have read a word of prose.
 */
export const eyebrow = (t: EmailTheme, text: string, tone: Tone = "brand"): string =>
  `<p style="margin:0;font-family:${t.sans};font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${toneColors(t, tone).fg};">${esc(text)}</p>`;

/**
 * Headings, in the site's own voice.
 *
 * Manrope extrabold with tight tracking — the same treatment `SectionTitle`
 * and the hero use, so a headline in an email and a headline on the site are
 * recognisably the same typography rather than two different products.
 */
export const heading = (t: EmailTheme, text: string, level: 1 | 2 | 3 = 2): string => {
  const size = level === 1 ? 26 : level === 2 ? 18 : 14.5;
  const weight = level === 3 ? 700 : 800;
  const tracking = level === 3 ? "-0.01em" : "-0.03em";
  return `<h${level} style="margin:0;font-family:${t.sans};font-size:${size}px;line-height:${level === 1 ? 1.15 : 1.35};font-weight:${weight};color:${t.ink};letter-spacing:${tracking};">${text}</h${level}>`;
};

/** The section label that opens a group of blocks. */
export const sectionLabel = (t: EmailTheme, text: string): string =>
  `<p style="margin:0;font-family:${t.sans};font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${t.muted};">${esc(text)}</p>`;

/** Body copy. `html` is inserted as-is — escape at the call site. */
export const paragraph = (
  t: EmailTheme,
  html: string,
  opts: { muted?: boolean; small?: boolean; lead?: boolean; align?: "left" | "center" } = {}
): string => {
  const size = opts.lead ? 15 : opts.small ? 12.5 : 14.5;
  const color = opts.muted ? t.muted : t.body;
  return `<p style="margin:0;font-family:${t.sans};font-size:${size}px;line-height:1.6;color:${color};text-align:${opts.align || "left"};">${html}</p>`;
};

export const strong = (t: EmailTheme, text: string): string =>
  `<strong style="color:${t.ink};font-weight:700;">${text}</strong>`;

export const link = (t: EmailTheme, label: string, href: string): string =>
  `<a href="${escUrl(href)}" style="color:${t.primaryDeep};text-decoration:underline;font-weight:600;">${label}</a>`;

/** Fine print — the closing line under a call to action. */
export const note = (t: EmailTheme, html: string): string =>
  `<p style="margin:0;font-family:${t.sans};font-size:12.5px;line-height:1.55;color:${t.muted};">${html}</p>`;

// --- Buttons ----------------------------------------------------------------

/**
 * A button that survives Outlook.
 *
 * A styled `<a>` collapses to a bare blue link in the Word engine, which is
 * how a "Reset your password" call to action becomes invisible. The MSO
 * conditional wraps a VML rounded rectangle that only Outlook parses; every
 * other client ignores the comment and renders the anchor.
 */
export const button = (
  t: EmailTheme,
  label: string,
  href: string,
  opts: { variant?: "primary" | "secondary" } = {}
): string => {
  const url = escUrl(href);
  const primary = opts.variant !== "secondary";
  const bg = primary ? t.primary : t.surface;
  const fg = primary ? t.onPrimary : t.ink;
  const border = primary ? t.primary : "#d5d5d8";
  const w = 250;
  const h = 43;

  // Always centred. The layout gives the call to action its own row at the
  // foot of the message, so it sits on the column's axis wherever a template
  // happens to put it.
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
  <tr><td align="center">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:${h}px;v-text-anchor:middle;width:${w}px;" arcsize="22%" strokecolor="${border}" fillcolor="${bg}">
      <w:anchorlock/>
      <center style="color:${fg};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${label}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${url}" style="display:inline-block;padding:13px 28px;background-color:${bg};color:${fg};border:1px solid ${border};text-decoration:none;border-radius:${t.radiusSm};font-family:${t.sans};font-weight:700;font-size:14px;line-height:1;letter-spacing:0.01em;mso-hide:all;">${label}</a>
    <!--<![endif]-->
  </td></tr>
</table>`;
};

// --- Cards ------------------------------------------------------------------

export interface DetailRow {
  label: string;
  value: string;
  /** Rendered larger and in the ink colour — for the one row that matters. */
  emphasis?: boolean;
  /** Monospaced. For IBANs, references and ticket ids, where a misread
   *  character means a payment that cannot be matched. */
  mono?: boolean;
}

const visibleRows = (rows: (DetailRow | null | undefined | false)[]) =>
  rows.filter((r): r is DetailRow => !!r && !!String(r.value ?? "").trim());

/**
 * Label/value rows, ruled.
 *
 * The hairline between rows is the whole point. Without it these were floating
 * pairs of text that the eye had to group by proximity alone; ruled, they read
 * as one table of facts — which is what a ticket, a bank instruction and a
 * receipt all actually are.
 */
const rowTable = (t: EmailTheme, rows: DetailRow[]): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows
    .map(
      (r, i) => `
    <tr>
      <td style="padding:${i === 0 ? 0 : 9}px 12px 9px 0;${i === rows.length - 1 ? "padding-bottom:0;" : `border-bottom:1px solid ${t.hairline};`}font-family:${t.sans};font-size:12.5px;line-height:1.4;color:${t.muted};vertical-align:top;white-space:nowrap;">${esc(r.label)}</td>
      <td style="padding:${i === 0 ? 0 : 9}px 0 9px 0;${i === rows.length - 1 ? "padding-bottom:0;" : `border-bottom:1px solid ${t.hairline};`}font-family:${r.mono ? t.mono : t.sans};font-size:${r.emphasis ? 15 : 13.5}px;line-height:1.4;font-weight:${r.emphasis ? 700 : 600};color:${t.ink};text-align:right;vertical-align:top;word-break:break-word;">${r.value}</td>
    </tr>`
    )
    .join("")}</table>`;

/**
 * The workhorse block: a titled card of facts.
 *
 * The title sits in its own strip above a hairline, so a card announces what
 * it is before the reader parses its contents. Rows whose value is empty are
 * dropped rather than rendered blank — half of `config.legal` is optional, and
 * a table full of em dashes reads as a broken email rather than an incomplete
 * configuration.
 */
export const dataCard = (
  t: EmailTheme,
  opts: {
    title?: string;
    rows?: (DetailRow | null | undefined | false)[];
    body?: string;
    footnote?: string;
    tone?: Tone;
  }
): string => {
  const c = toneColors(t, opts.tone || "neutral");
  const rows = visibleRows(opts.rows || []);
  if (!rows.length && !opts.body) return "";

  const header = opts.title
    ? `<tr><td style="padding:10px 16px;background-color:${c.bg};border-bottom:1px solid ${c.border};font-family:${t.sans};font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${c.fg};">${esc(opts.title)}</td></tr>`
    : "";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${t.surface};border:1px solid ${c.border};border-radius:${t.radius};overflow:hidden;">
  ${header}
  <tr><td style="padding:15px 16px;">
    ${opts.body || ""}
    ${opts.body && rows.length ? `<div style="height:${SPACE.md}px;line-height:${SPACE.md}px;font-size:0;">&nbsp;</div>` : ""}
    ${rows.length ? rowTable(t, rows) : ""}
    ${opts.footnote ? `<div style="height:${SPACE.md}px;line-height:${SPACE.md}px;font-size:0;">&nbsp;</div><p style="margin:0;padding-top:14px;border-top:1px solid ${t.hairline};font-family:${t.sans};font-size:12px;line-height:1.6;color:${t.muted};">${opts.footnote}</p>` : ""}
  </td></tr>
</table>`;
};

/**
 * A tinted callout. Use `tone` to say what kind of news it carries.
 *
 * The coloured bar down the left edge does the work `border-radius` cannot in
 * Outlook: it survives the Word engine, so the callout still reads as a
 * callout there rather than as an unstyled paragraph.
 */
export const notice = (
  t: EmailTheme,
  opts: { title?: string; body: string; tone?: Tone }
): string => {
  const c = toneColors(t, opts.tone || "warning");
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${c.bg};border:1px solid ${c.border};border-radius:${t.radiusSm};">
  <tr>
    <td width="4" style="width:4px;background-color:${c.bar};font-size:0;line-height:0;">&nbsp;</td>
    <td style="padding:12px 16px;">
      ${opts.title ? `<p style="margin:0 0 6px;font-family:${t.sans};font-size:12.5px;font-weight:800;color:${c.fg};">${esc(opts.title)}</p>` : ""}
      <p style="margin:0;font-family:${t.sans};font-size:12.5px;line-height:1.6;color:${t.body};">${opts.body}</p>
    </td>
  </tr>
</table>`;
};

/**
 * The amount, given the weight it deserves.
 *
 * Large and extrabold, because in a payment email this is the single number
 * the reader is looking for, and burying it in a table row means they have to
 * hunt for it. `tabular-nums` keeps the digits on a common width so a column
 * of amounts lines up.
 */
export const amountCard = (
  t: EmailTheme,
  opts: { caption: string; amount: number; currency?: string; sub?: string; tone?: Tone }
): string => {
  const c = toneColors(t, opts.tone || "brand");
  const symbol = !opts.currency || opts.currency === "EUR" ? "€" : `${opts.currency} `;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${c.bg};border:1px solid ${c.border};border-radius:${t.radius};">
  <tr><td style="padding:20px 18px;text-align:center;">
    <p style="margin:0 0 8px;font-family:${t.sans};font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${c.fg};">${esc(opts.caption)}</p>
    <p style="margin:0;font-family:${t.sans};font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-0.035em;color:${t.ink};font-variant-numeric:tabular-nums;">${symbol}${opts.amount.toFixed(2)}</p>
    ${opts.sub ? `<p style="margin:8px 0 0;font-family:${t.sans};font-size:12.5px;line-height:1.5;color:${t.body};">${opts.sub}</p>` : ""}
  </td></tr>
</table>`;
};

/** A one-time code, spaced so it can be read off a screen and typed. */
export const codeBlock = (t: EmailTheme, code: string): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${t.primaryTint};border:1px solid ${t.primaryEdge};border-radius:${t.radius};">
  <tr><td style="padding:22px 18px;text-align:center;">
    <p style="margin:0;font-family:${t.mono};font-size:31px;line-height:1;font-weight:700;letter-spacing:0.24em;color:${t.primaryDeep};text-indent:0.24em;">${esc(code)}</p>
  </td></tr>
</table>`;

/** A single-line status flag — "Pending verification", "Payment received". */
export const statusPill = (t: EmailTheme, label: string, tone: Tone = "neutral"): string => {
  const c = toneColors(t, tone);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:6px 13px;background-color:${c.bg};border:1px solid ${c.border};border-radius:999px;font-family:${t.sans};font-size:11px;font-weight:800;color:${c.fg};letter-spacing:0.1em;text-transform:uppercase;">${esc(label)}</td></tr></table>`;
};

// --- Event -----------------------------------------------------------------

export interface EventCardData {
  title: string;
  date: Date;
  startTime?: string | null;
  endTime?: string | null;
  location: string;
  address?: string | null;
  /** Struck through, alongside the new one, when an event is rescheduled. */
  previousDate?: Date | null;
}

const formatDate = (d: Date) =>
  new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/**
 * The event, as a card.
 *
 * The event title is the card's header strip rather than a line inside it, so
 * the block identifies itself at a glance. Everything below is the same ruled
 * table as every other card in the system — an event and a bank instruction
 * should not look like they came from two different products.
 */
export const eventCard = (t: EmailTheme, e: EventCardData): string => {
  const time = [e.startTime, e.endTime].filter(Boolean).join(" – ");
  const mapQuery = encodeURIComponent(`${e.location}${e.address ? `, ${e.address}` : ""}`);

  return dataCard(t, {
    title: e.title,
    tone: "brand",
    rows: [
      e.previousDate
        ? {
            label: "Was",
            value: `<span style="text-decoration:line-through;color:${t.muted};font-weight:500;">${esc(formatDate(e.previousDate))}</span>`,
          }
        : null,
      { label: e.previousDate ? "Now" : "Date", value: esc(formatDate(e.date)), emphasis: true },
      time ? { label: "Time", value: esc(time) } : null,
      { label: "Venue", value: esc(e.location) },
      e.address ? { label: "Address", value: esc(e.address) } : null,
    ],
    footnote: `<a href="https://www.google.com/maps/search/?api=1&amp;query=${mapQuery}" style="color:${t.primaryDeep};text-decoration:underline;font-weight:600;">Open in Maps →</a>`,
  });
};

// --- Prose blocks -----------------------------------------------------------

/** Quoted user-supplied prose — a rejection reason, a contact message. */
export const quote = (t: EmailTheme, text: string): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="3" style="width:3px;background-color:${t.primaryEdge};font-size:0;line-height:0;">&nbsp;</td>
    <td style="padding:1px 0 1px 16px;font-family:${t.sans};font-size:13.5px;line-height:1.6;color:${t.body};white-space:pre-wrap;">${esc(text)}</td>
  </tr>
</table>`;

/** A short list. Mail clients disagree about `<ul>` indentation, so this is a
 *  table with its own bullets. */
export const bulletList = (t: EmailTheme, items: string[]): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  ${items
    .map(
      (item, i) => `<tr>
    <td width="20" style="width:20px;padding:${i === 0 ? 0 : 9}px 0 0 0;font-family:${t.sans};font-size:14.5px;line-height:1.6;color:${t.primary};vertical-align:top;">&bull;</td>
    <td style="padding:${i === 0 ? 0 : 9}px 0 0 0;font-family:${t.sans};font-size:14.5px;line-height:1.6;color:${t.body};">${item}</td>
  </tr>`
    )
    .join("")}
</table>`;

/** Numbered steps, for "what happens next". */
export const steps = (t: EmailTheme, items: string[]): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  ${items
    .map(
      (item, i) => `<tr>
    <td width="30" style="width:30px;padding:${i === 0 ? 0 : 11}px 0 0 0;vertical-align:top;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="22" height="22" align="center" style="width:22px;height:22px;background-color:${t.primaryTint};border-radius:11px;font-family:${t.sans};font-size:11px;font-weight:800;color:${t.primaryDeep};line-height:22px;">${i + 1}</td></tr></table>
    </td>
    <td style="padding:${i === 0 ? 1 : 12}px 0 0 0;font-family:${t.sans};font-size:13.5px;line-height:1.55;color:${t.body};">${item}</td>
  </tr>`
    )
    .join("")}
</table>`;
