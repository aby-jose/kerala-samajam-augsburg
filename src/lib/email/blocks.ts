/**
 * The block vocabulary, rebuilt to the home page's language.
 *
 * The rule that shapes every block here: **nothing fills itself.**
 *
 * The previous vocabulary gave each block a tinted background and a rounded
 * border, so a message read as a column of cards. The home page deliberately
 * does the opposite — `about-intro.tsx` sets its six pillars as "a hairline
 * rule over each entry rather than a boxed cell — so this block does not read
 * as yet another card grid". Bands supply the containers; hairlines divide
 * what is inside them.
 *
 * That is also what makes the blocks composable. The shell decides which band
 * a section lands on, and it decides that *after* the template has already
 * built its blocks. A block that painted its own background would have to know
 * something it cannot know — and since `primaryTint` (6% brand) is darker than
 * `bandB` (5%), a tinted card on a tinted band would have disappeared.
 *
 * Outlook constraints carried over unchanged from `components.ts`: tables
 * rather than divs, inline styles rather than classes, and no reliance on
 * `border-radius`, which the Word engine drops.
 */

import { type EmailTheme } from "./tokens";

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

/** Which palette a block paints against. The shell passes this down. */
export type Surface = "light" | "deep";

interface Ink {
  ink: string;
  body: string;
  muted: string;
  hairline: string;
  accent: string;
}

/**
 * The four text colours and the rule colour, for the band in play.
 *
 * A block is written once and rendered on either a light band or the closing
 * dark one. Passing the palette in beats duplicating every block.
 */
export const inkFor = (t: EmailTheme, surface: Surface = "light"): Ink =>
  surface === "deep"
    ? {
        ink: t.deepInk,
        body: t.deepBody,
        muted: t.deepBody,
        hairline: t.deepHairline,
        // The derived `primaryDeep` is darkened for contrast on white, which
        // makes it unreadable on black. On the dark band the flat brand colour
        // is the legible one.
        accent: t.primary,
      }
    : {
        ink: t.ink,
        body: t.body,
        muted: t.muted,
        hairline: t.hairline,
        accent: t.primaryDeep,
      };

// --- Vertical rhythm --------------------------------------------------------

/**
 * Stack blocks with one consistent gap.
 *
 * Spacing is a real table cell rather than a margin, which Outlook collapses
 * unpredictably, and empty entries vanish instead of leaving a hole.
 */
export const stack = (
  blocks: (string | null | undefined | false)[],
  gap: number = 22
): string => {
  const visible = blocks.filter((b): b is string => !!b && b.trim() !== "");
  if (!visible.length) return "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${visible
    .map(
      (block, i) =>
        `<tr><td style="padding-top:${i === 0 ? 0 : gap}px;">${block}</td></tr>`
    )
    .join("")}</table>`;
};

export const rule = (t: EmailTheme, surface: Surface = "light"): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="${surface === "deep" ? "" : "tk-hr-bg"}" style="height:1px;line-height:1px;font-size:0;background-color:${inkFor(t, surface).hairline};">&nbsp;</td></tr></table>`;

export const spacer = (height: number): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</td></tr></table>`;

// --- Typography -------------------------------------------------------------

/**
 * The pill eyebrow — the site's single most recognisable small element.
 *
 * `section-heading.tsx` renders it as a rounded-full border with a brand dot
 * and 10px/0.22em uppercase type. Outlook drops `border-radius`, so there it
 * degrades to a bordered rectangle with a square dot. That was judged an
 * acceptable loss: spending VML on an eyebrow buys a rounded corner in one
 * client at the cost of markup nobody can edit safely.
 */
export const pill = (
  t: EmailTheme,
  text: string,
  surface: Surface = "light"
): string => {
  const deep = surface === "deep";
  const border = deep ? t.deepEdge : t.hairline;
  const bg = deep ? t.deepPanel : t.surface;
  const fg = deep ? t.deepBody : t.muted;
  // Already dark on the closing band — only the light surface needs a hook to
  // repaint under `prefers-color-scheme: dark`.
  const cls = deep ? "" : " tk-chip tk-hr";
  const fgCls = deep ? "" : " tk-muted";

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
  <tr>
    <td class="${cls.trim()}" style="padding:6px 14px;background-color:${bg};border:1px solid ${border};border-radius:999px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="6" style="width:6px;padding-right:9px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td width="6" height="6" style="width:6px;height:6px;line-height:6px;font-size:0;background-color:${t.primary};border-radius:3px;">&nbsp;</td></tr>
            </table>
          </td>
          <td class="${fgCls.trim()}" style="font-family:${t.sans};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${fg};white-space:nowrap;">${esc(text)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
};

/**
 * A headline with one accent word, in the brand colour.
 *
 * The site sets the accent as a Newsreader italic word inside a Manrope
 * heading. Here it stays Manrope and carries the brand colour instead — one
 * face, so no second web-font request and nothing to fall back to Georgia in
 * the clients that strip `<link>`.
 *
 * The accent must occur in the title verbatim; when it is blank or absent the
 * whole title renders plain, which is the same fallback `splitOnAccent` gives
 * the home page.
 */
export const headline = (
  t: EmailTheme,
  title: string,
  accentWord: string | undefined,
  surface: Surface = "light",
  size = 27
): string => {
  const c = inkFor(t, surface);
  const deep = surface === "deep";
  const style = `margin:0;font-family:${t.sans};font-size:${size}px;line-height:1.15;font-weight:800;color:${c.ink};letter-spacing:-0.035em;`;
  const inkCls = deep ? "" : ' class="tk-ink"';
  const accentCls = deep ? "" : ' class="tk-accent"';

  const at = accentWord ? title.indexOf(accentWord) : -1;
  if (!accentWord || at === -1) {
    return `<h1${inkCls} style="${style}">${esc(title)}</h1>`;
  }

  return `<h1${inkCls} style="${style}">${esc(title.slice(0, at))}<span${accentCls} style="color:${c.accent};">${esc(accentWord)}</span>${esc(title.slice(at + accentWord.length))}</h1>`;
};

/** The small tracked label that opens a section. Rendered by the shell. */
export const sectionLabel = (
  t: EmailTheme,
  text: string,
  surface: Surface = "light"
): string =>
  `<p${surface === "deep" ? "" : ' class="tk-muted"'} style="margin:0;font-family:${t.sans};font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${inkFor(t, surface).muted};">${esc(text)}</p>`;

/** Body copy. `html` is inserted as-is — escape at the call site. */
export const paragraph = (
  t: EmailTheme,
  html: string,
  opts: {
    muted?: boolean;
    small?: boolean;
    lead?: boolean;
    align?: "left" | "center";
    surface?: Surface;
  } = {}
): string => {
  const c = inkFor(t, opts.surface);
  const size = opts.lead ? 15 : opts.small ? 12.5 : 14.5;
  const cls = opts.surface === "deep" ? "" : ` class="${opts.muted ? "tk-muted" : "tk-body"}"`;
  return `<p${cls} style="margin:0;font-family:${t.sans};font-size:${size}px;line-height:1.6;color:${opts.muted ? c.muted : c.body};text-align:${opts.align || "left"};">${html}</p>`;
};

export const strong = (t: EmailTheme, text: string, surface: Surface = "light"): string =>
  `<strong${surface === "deep" ? "" : ' class="tk-ink"'} style="color:${inkFor(t, surface).ink};font-weight:700;">${text}</strong>`;

export const link = (
  t: EmailTheme,
  label: string,
  href: string,
  surface: Surface = "light"
): string =>
  `<a href="${escUrl(href)}"${surface === "deep" ? "" : ' class="tk-accent"'} style="color:${inkFor(t, surface).accent};text-decoration:underline;font-weight:600;">${label}</a>`;

/** Fine print — the closing line under a call to action. */
export const note = (t: EmailTheme, html: string, surface: Surface = "light"): string =>
  `<p${surface === "deep" ? "" : ' class="tk-muted"'} style="margin:0;font-family:${t.sans};font-size:12.5px;line-height:1.55;color:${inkFor(t, surface).muted};">${html}</p>`;

// --- Buttons ----------------------------------------------------------------

/**
 * A button that survives Outlook, shaped like the site's.
 *
 * Every button on the site is `rounded-full` — `arcsize="50%"` is the VML
 * equivalent, replacing the 10px radius the old button used.
 *
 * A styled `<a>` collapses to a bare blue link in the Word engine, which is
 * how "Reset your password" becomes invisible. The MSO conditional wraps a VML
 * rounded rectangle only Outlook parses; every other client ignores the
 * comment and renders the anchor.
 */
export const button = (
  t: EmailTheme,
  label: string,
  href: string,
  opts: { variant?: "primary" | "ghost"; surface?: Surface } = {}
): string => {
  const url = escUrl(href);
  const deep = opts.surface === "deep";
  const ghost = opts.variant === "ghost";

  const bg = ghost ? (deep ? t.deepPanel : t.surface) : t.primary;
  const fg = ghost ? (deep ? t.deepInk : t.ink) : t.onPrimary;
  const border = ghost ? (deep ? t.deepEdge : "#d5d5d8") : t.primary;

  // Only the ghost variant on the light surface needs to repaint in dark
  // mode — the primary (brand-filled) button already carries the same
  // contrast on either background.
  const cls = ghost && !deep ? ' class="tk-chip tk-hr tk-ink"' : "";

  const w = 258;
  const h = 46;

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
  <tr><td align="center">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:${h}px;v-text-anchor:middle;width:${w}px;" arcsize="50%" strokecolor="${border}" fillcolor="${bg}">
      <w:anchorlock/>
      <center style="color:${fg};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${label}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${url}"${cls} style="display:inline-block;padding:14px 30px;background-color:${bg};color:${fg};border:1px solid ${border};text-decoration:none;border-radius:999px;font-family:${t.sans};font-weight:700;font-size:14px;line-height:1;letter-spacing:0.01em;mso-hide:all;">${label}</a>
    <!--<![endif]-->
  </td></tr>
</table>`;
};

// --- Facts ------------------------------------------------------------------

export interface Fact {
  label: string;
  value: string;
  /** Larger and in the ink colour — for the one row that matters. */
  emphasis?: boolean;
  /** Monospaced. For IBANs, references and ticket ids, where a misread
   *  character means a payment that cannot be matched. */
  mono?: boolean;
}

const visible = (rows: (Fact | null | undefined | false)[]) =>
  rows.filter((r): r is Fact => !!r && !!String(r.value ?? "").trim());

/**
 * Label/value rows, hairline-ruled, no box.
 *
 * This is the direct analogue of the home page's spec row — the `<dl>` in
 * `about-intro.tsx` that sets its three facts between `border-y` rules
 * "rather than a stat block". A ticket, a bank instruction and a receipt are
 * all tables of facts; ruled, they read as one.
 *
 * Rows whose value is empty are dropped rather than rendered blank: half of
 * `config.legal` is optional, and a table full of em dashes reads as a broken
 * email rather than an incomplete configuration.
 */
export const facts = (
  t: EmailTheme,
  rows: (Fact | null | undefined | false)[],
  surface: Surface = "light"
): string => {
  const list = visible(rows);
  if (!list.length) return "";
  const c = inkFor(t, surface);
  const deep = surface === "deep";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${list
    .map((r, i) => {
      const last = i === list.length - 1;
      const hrCls = deep || last ? "" : " tk-hr";
      const cell = `padding:${i === 0 ? 0 : 14}px 0 ${last ? 0 : 14}px;${last ? "" : `border-bottom:1px solid ${c.hairline};`}`;
      const labelCls = (deep ? "" : "tk-muted") + hrCls;
      const valueCls = (deep ? "" : "tk-ink") + hrCls;
      return `
    <tr>
      <td class="${labelCls.trim()}" style="${cell}padding-right:14px;font-family:${t.sans};font-size:12.5px;line-height:1.4;color:${c.muted};vertical-align:top;white-space:nowrap;">${esc(r.label)}</td>
      <td class="${valueCls.trim()}" style="${cell}font-family:${r.mono ? t.mono : t.sans};font-size:${r.emphasis ? 15 : 13.5}px;line-height:1.4;font-weight:${r.emphasis ? 700 : 600};color:${c.ink};text-align:right;vertical-align:top;word-break:break-word;">${r.value}</td>
    </tr>`;
    })
    .join("")}</table>`;
};

/**
 * The amount, given the weight it deserves.
 *
 * Large, extrabold and tight-tracked between two rules — the same treatment
 * the home page gives `2012` and `e.V.` in its fact row, scaled up. In a
 * payment email this is the one number the reader is hunting for.
 * `tabular-nums` keeps a column of amounts aligned.
 */
export const amount = (
  t: EmailTheme,
  opts: {
    caption: string;
    amount: number;
    currency?: string;
    sub?: string;
    surface?: Surface;
  }
): string => {
  const c = inkFor(t, opts.surface);
  const deep = opts.surface === "deep";
  const symbol = !opts.currency || opts.currency === "EUR" ? "€" : `${esc(opts.currency)} `;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="${deep ? "" : "tk-hr"}" style="border-top:1px solid ${c.hairline};border-bottom:1px solid ${c.hairline};">
  <tr><td style="padding:30px 0;text-align:center;">
    <p${deep ? "" : ' class="tk-accent"'} style="margin:0 0 12px;font-family:${t.sans};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${c.accent};">${esc(opts.caption)}</p>
    <p${deep ? "" : ' class="tk-ink"'} style="margin:0;font-family:${t.sans};font-size:36px;line-height:1.05;font-weight:800;letter-spacing:-0.04em;color:${c.ink};font-variant-numeric:tabular-nums;">${symbol}${opts.amount.toFixed(2)}</p>
    ${opts.sub ? `<p${deep ? "" : ' class="tk-body"'} style="margin:14px auto 0;max-width:390px;font-family:${t.sans};font-size:12.5px;line-height:1.6;color:${c.body};">${opts.sub}</p>` : ""}
  </td></tr>
</table>`;
};

/** A one-time code, spaced so it can be read off a screen and typed. */
export const code = (t: EmailTheme, value: string, surface: Surface = "light"): string => {
  const c = inkFor(t, surface);
  const deep = surface === "deep";
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="${deep ? "" : "tk-hr"}" style="border-top:1px solid ${c.hairline};border-bottom:1px solid ${c.hairline};">
  <tr><td style="padding:34px 0;text-align:center;">
    <p${deep ? "" : ' class="tk-accent"'} style="margin:0;font-family:${t.mono};font-size:32px;line-height:1;font-weight:700;letter-spacing:0.26em;color:${c.accent};text-indent:0.26em;">${esc(value)}</p>
  </td></tr>
</table>`;
};

/** A single-line status flag — "Pending verification", "Payment received". */
export const statusPill = (
  t: EmailTheme,
  label: string,
  surface: Surface = "light"
): string => {
  const c = inkFor(t, surface);
  const deep = surface === "deep";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="${deep ? "" : "tk-hr tk-accent"}" style="padding:6px 13px;border:1px solid ${c.hairline};border-radius:999px;font-family:${t.sans};font-size:10px;font-weight:700;color:${c.accent};letter-spacing:0.18em;text-transform:uppercase;white-space:nowrap;">${esc(label)}</td></tr></table>`;
};

// --- Interruptions ----------------------------------------------------------

/**
 * A callout. Keeps its brand bar, loses its fill.
 *
 * The bar down the left edge does the work `border-radius` cannot in Outlook:
 * it survives the Word engine, so the callout still reads as a callout there
 * rather than as an unstyled paragraph. Without a fill it works on any band.
 */
export const notice = (
  t: EmailTheme,
  opts: { title?: string; body: string; surface?: Surface }
): string => {
  const c = inkFor(t, opts.surface);
  const deep = opts.surface === "deep";
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="3" style="width:3px;background-color:${t.primary};font-size:0;line-height:0;">&nbsp;</td>
    <td style="padding:2px 0 2px 16px;">
      ${opts.title ? `<p${deep ? "" : ' class="tk-accent"'} style="margin:0 0 5px;font-family:${t.sans};font-size:12.5px;font-weight:800;color:${c.accent};">${esc(opts.title)}</p>` : ""}
      <p${deep ? "" : ' class="tk-body"'} style="margin:0;font-family:${t.sans};font-size:12.5px;line-height:1.6;color:${c.body};">${opts.body}</p>
    </td>
  </tr>
</table>`;
};

/** Quoted user-supplied prose — a rejection reason, a contact message. */
export const quote = (t: EmailTheme, text: string, surface: Surface = "light"): string => {
  const c = inkFor(t, surface);
  const deep = surface === "deep";
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="3" class="${deep ? "" : "tk-hr-bg"}" style="width:3px;background-color:${c.hairline};font-size:0;line-height:0;">&nbsp;</td>
    <td${deep ? "" : ' class="tk-body"'} style="padding:1px 0 1px 16px;font-family:${t.sans};font-size:13.5px;line-height:1.6;color:${c.body};white-space:pre-wrap;">${esc(text)}</td>
  </tr>
</table>`;
};

/** A short list. Mail clients disagree about `<ul>` indentation, so this is a
 *  table with its own bullets. */
export const bulletList = (
  t: EmailTheme,
  items: string[],
  surface: Surface = "light"
): string => {
  const c = inkFor(t, surface);
  const bodyCls = surface === "deep" ? "" : ' class="tk-body"';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  ${items
    .map(
      (item, i) => `<tr>
    <td width="18" style="width:18px;padding:${i === 0 ? 0 : 9}px 0 0 0;font-family:${t.sans};font-size:14.5px;line-height:1.6;color:${t.primary};vertical-align:top;">&bull;</td>
    <td${bodyCls} style="padding:${i === 0 ? 0 : 9}px 0 0 0;font-family:${t.sans};font-size:14.5px;line-height:1.6;color:${c.body};">${item}</td>
  </tr>`
    )
    .join("")}
</table>`;
};

/**
 * Numbered steps, indexed like the home page.
 *
 * `about-intro.tsx` numbers its pillars with a mono `01` at 10px/0.2em, and
 * `join-steps.tsx` does the same. The old version used a filled brand circle,
 * which was both a fill (so it could not travel across bands) and a motif that
 * appears nowhere on the site.
 */
export const steps = (
  t: EmailTheme,
  items: string[],
  surface: Surface = "light"
): string => {
  const c = inkFor(t, surface);
  const deep = surface === "deep";
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  ${items
    .map(
      (item, i) => `<tr>
    <td width="36"${deep ? "" : ' class="tk-accent"'} style="width:36px;padding:${i === 0 ? 0 : 17}px 0 0 0;font-family:${t.mono};font-size:10px;letter-spacing:0.2em;color:${c.accent};vertical-align:top;line-height:1.95;">${String(i + 1).padStart(2, "0")}</td>
    <td${deep ? "" : ' class="tk-body"'} style="padding:${i === 0 ? 0 : 17}px 0 0 0;font-family:${t.sans};font-size:13.5px;line-height:1.65;color:${c.body};">${item}</td>
  </tr>`
    )
    .join("")}
</table>`;
};

// --- Event ------------------------------------------------------------------

export interface EventFacts {
  title: string;
  date: Date;
  startTime?: string | null;
  endTime?: string | null;
  location: string;
  address?: string | null;
  /** Struck through, alongside the new one, when an event is rescheduled. */
  previousDate?: Date | null;
}

export const formatDate = (d: Date) =>
  new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/**
 * The event, as facts plus a map link.
 *
 * Returns blocks rather than a card: the shell puts the event title in the
 * section label, so the block itself is the same ruled table every other set
 * of facts uses. An event and a bank instruction should not look like they
 * came from two different products.
 */
export const eventFacts = (
  t: EmailTheme,
  e: EventFacts,
  surface: Surface = "light"
): string => {
  const time = [e.startTime, e.endTime].filter(Boolean).join(" – ");
  const mapQuery = encodeURIComponent(`${e.location}${e.address ? `, ${e.address}` : ""}`);
  const c = inkFor(t, surface);
  const deep = surface === "deep";

  return stack(
    [
      facts(
        t,
        [
          e.previousDate
            ? {
                label: "Was",
                value: `<span${deep ? "" : ' class="tk-muted"'} style="text-decoration:line-through;color:${c.muted};font-weight:500;">${esc(formatDate(e.previousDate))}</span>`,
              }
            : null,
          { label: e.previousDate ? "Now" : "Date", value: esc(formatDate(e.date)), emphasis: true },
          time ? { label: "Time", value: esc(time) } : null,
          { label: "Venue", value: esc(e.location) },
          e.address ? { label: "Address", value: esc(e.address) } : null,
        ],
        surface
      ),
      `<a href="https://www.google.com/maps/search/?api=1&amp;query=${mapQuery}"${deep ? "" : ' class="tk-accent"'} style="font-family:${t.sans};font-size:12.5px;color:${c.accent};text-decoration:underline;font-weight:600;">Open in Maps &rarr;</a>`,
    ],
    12
  );
};
