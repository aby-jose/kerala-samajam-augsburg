/**
 * The shell every message is rendered into, rebuilt to the home page's shape.
 *
 * What changed from `layout.ts`, and why:
 *
 * 1. **The body is an ordered list of sections, not one blob.** The shell
 *    assigns each section its band from its *position*, using the same rule
 *    the home page settled on — surfaces computed, never stored (D4 in the
 *    home page spec). A template cannot pick a colour, so two identical
 *    adjacent bands are impossible by construction.
 *
 * 2. **The eyebrow is the site's pill** — rounded border, brand dot,
 *    10px/0.22em — instead of a bare tracked label.
 *
 * 3. **The headline carries one accent word** in the brand colour, the way
 *    every heading on the site carries one accent word.
 *
 * 4. **The message closes on a dark band**, as the home page closes on its
 *    `surface-deep` call-to-action band before the footer.
 *
 *   ┌────────────────────────────────┐
 *   │ ▬▬▬▬▬ brand bar                │
 *   │           [logo]               │  masthead   white
 *   │      KERALA SAMAJAM            │
 *   ├────────────────────────────────┤
 *   │      ( • EVENT TICKET )        │  pill
 *   │      You're on the LIST        │  hero       white
 *   │      Ammu, your place is held  │
 *   ├────────────────────────────────┤
 *   │  YOUR TICKET                   │  section 0  band A
 *   │  Date ─────────  12 Sep 2026   │
 *   ├────────────────────────────────┤
 *   │  ON THE DAY                    │  section 1  white
 *   │  01  Arrive from 5pm           │
 *   ├────────────────────────────────┤
 *   │      ( • NEXT )                │
 *   │      See you there             │  close      #0f0f0f
 *   │      [ View event details ]    │
 *   ├────────────────────────────────┤
 *   │  Events · Gallery · Membership │  footer
 *   └────────────────────────────────┘
 */

import type { LegalEntityConfig } from "../config-schema";
import {
  LAYOUT,
  buildTheme,
  resolveLogo,
  siteOrigin,
  type EmailBranding,
  type EmailTheme,
} from "./tokens";
import { button, esc, escUrl, headline, note, pill, sectionLabel, stack } from "./blocks";

/**
 * The shell's own spacing, deliberately more generous than `SPACE`.
 *
 * The first pass reused the old scale and the message came out tight: 34px
 * gutters against a 600px column, which is not enough air for a section to
 * read as its own panel rather than as a strip.
 *
 * A section panel is inset from the card by `inset` and padded again by
 * `panelX` inside, so its text column is 600 − 2(20 + 24 + 1) = 510px — close
 * to the measure the site sets its body copy at. Full-width rows (masthead,
 * hero, call to action) use `gutter` to land on the same column.
 *
 * Local rather than a change to `SPACE`, so the existing `layout.ts` and the
 * 44 templates still on it render byte-identically while both systems coexist.
 */
const PAD = {
  gutter: 40,
  gutterMobile: 24,
  /** Inset from the card edge to a section panel. */
  inset: 20,
  insetMobile: 14,
  /** Half the gap between two stacked panels. */
  gap: 10,
  /** Padding inside a section panel. */
  panelY: 26,
  panelX: 24,
  panelXMobile: 18,
  /** The gap between blocks inside one panel. */
  block: 22,
  masthead: 30,
  close: 38,
} as const;

/**
 * How many sections a message may carry before it stops being an email.
 *
 * Not enforced — a hard throw at render time would take down a send over a
 * layout opinion. It is checked in the test suite instead, where the fix is
 * cheap. Three labelled bands plus a hero plus a closing band is a page, and
 * the reader stops scrolling long before the end of it.
 */
export const MAX_SECTIONS = 2;

export interface MessageContext {
  siteName: string;
  contactEmail: string;
  branding: EmailBranding;
  legal: LegalEntityConfig;
  /**
   * Present only on optional mail — announcements, reminders, newsletters.
   *
   * Transactional mail must never carry one. A member who unsubscribes from
   * the footer of their own payment receipt has, as far as they know, opted
   * out of receiving receipts, and the association has lost its record that
   * one was delivered.
   */
  unsubscribeUrl?: string;
}

/** One band's worth of content. The shell decides which band. */
export interface MessageSection {
  /** The small tracked label above the blocks. */
  label?: string;
  blocks: (string | null | undefined | false)[];
}

/**
 * The dark band at the foot: the call to action and its fine print.
 *
 * `title` and `lead` exist but should stay empty on almost every message. A
 * transactional email has already told the reader what happened by the time
 * they reach the bottom; a second headline down here is home-page CTA copy
 * pasted into a receipt, and it is most of why the first draft scrolled. Use
 * them only where the closing band genuinely changes the subject — a renewal
 * notice inviting someone to rejoin, say.
 */
export interface MessageClose {
  eyebrow?: string;
  title?: string;
  accentWord?: string;
  lead?: string;
  button?: { label: string; href: string };
  note?: string;
}

export interface Message {
  subject: string;
  previewText: string;
  /** Short category label — "Event ticket", "Receipt", "Security notice". */
  eyebrow: string;
  /** The headline. Plain text; escaped by the shell. */
  title: string;
  /** A word occurring verbatim in `title`, rendered in the brand colour. */
  accentWord?: string;
  /** One or two sentences under the headline. HTML — escape at the call site. */
  lead?: string;
  /**
   * The body, as ordered panels.
   *
   * Required rather than optional. A message with no body passes `[]` — three
   * templates do, among them the one-time code and the email verification —
   * which keeps every template's shape identical and means the shell never has
   * to guess whether an absent field meant "empty" or "forgotten".
   */
  sections: MessageSection[];
  close?: MessageClose;
}

/**
 * Hidden text the inbox shows next to the subject line.
 *
 * Without one, Gmail and Apple Mail pull the first readable text out of the
 * body — which, before this existed, was the logo's alt text, so every message
 * previewed as "Kerala Samajam Augsburg". The trailing entities pad the
 * snippet so no body copy leaks in behind the intended text.
 */
const preheader = (text: string): string =>
  `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(text)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>`;

/**
 * Logo above the wordmark, both centred.
 *
 * The message is a single 600px column with a symmetrical frame, so the
 * masthead sits on its axis rather than pulling to one edge.
 */
const masthead = (t: EmailTheme, ctx: MessageContext): string => `
<tr>
  <td class="pad" align="center" style="padding:${PAD.masthead}px ${PAD.gutter}px 26px;background-color:${t.surface};text-align:center;">
    <a href="${escUrl(siteOrigin())}" style="text-decoration:none;">
      <img src="${esc(resolveLogo(ctx.branding.logoUrl))}" alt="${esc(ctx.siteName)}" width="52" height="52" style="width:52px;height:52px;display:block;margin:0 auto 10px;border:0;outline:none;" />
      <span style="display:block;font-family:${t.sans};font-size:17px;font-weight:800;line-height:1.3;color:${t.ink};letter-spacing:-0.025em;">${esc(ctx.siteName)}</span>
    </a>
  </td>
</tr>`;

/**
 * Pill, headline, lead — centred, on white.
 *
 * The hero keeps the base surface so the masthead and the opening read as one
 * block; the first *section* takes the first tint, which is what separates
 * them. Starting the rotation on a tint rather than on white is the one
 * difference from the home page, where a black hero already provides the break.
 */
const hero = (t: EmailTheme, m: Message): string => `
<tr>
  <td class="pad" align="center" style="padding:8px ${PAD.gutter}px 26px;background-color:${t.surface};text-align:center;">
    ${pill(t, m.eyebrow)}
    <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
    ${headline(t, m.title, m.accentWord)}
    ${m.lead ? `<p style="margin:16px auto 0;max-width:430px;font-family:${t.sans};font-size:15px;line-height:1.7;color:${t.body};">${m.lead}</p>` : ""}
  </td>
</tr>`;

/**
 * Which band a section lands on, from its position alone.
 *
 * Base and tint alternate, and the tints themselves cycle A, B, A, B — the
 * same base-then-tint alternation `resolveSections` uses on the home page,
 * rather than an `n % 3` cycle. Two identical adjacent bands cannot occur, at
 * any length, without the template knowing anything about colour.
 */
export const bandFor = (t: EmailTheme, index: number): string => {
  if (index % 2 === 1) return t.surface;
  return (index / 2) % 2 === 0 ? t.bandA : t.bandB;
};

const bandClass = (index: number): string =>
  index % 2 === 1 ? "band-base" : (index / 2) % 2 === 0 ? "band-a" : "band-b";

/**
 * A section, as an inset rounded panel.
 *
 * These were full-bleed bands running edge to edge inside the card. As panels
 * they match what the site actually draws — `rounded-[1.5rem] border
 * border-border` on the About collage, `rounded-2xl border border-border
 * bg-surface-1` on the event cards — and the white margin around each one does
 * the separating that a border-top was doing before.
 *
 * The band rotation still decides the fill, so a panel is tinted or white by
 * position and never by its own choice. A white panel is not invisible: it
 * carries the same hairline border, which is exactly how the home page's event
 * cards sit on their own surface.
 */
const section = (t: EmailTheme, s: MessageSection, index: number): string => {
  const blocks = stack(s.blocks, PAD.block);
  if (!blocks) return "";

  return `
<tr>
  <td class="inset ${bandClass(index)}" style="padding:${PAD.gap}px ${PAD.inset}px;background-color:${t.surface};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${bandFor(t, index)};border:1px solid ${t.hairline};border-radius:${t.radius};">
      <tr>
        <td class="panel" style="padding:${PAD.panelY}px ${PAD.panelX}px;">
          ${s.label ? `${sectionLabel(t, s.label)}<div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>` : ""}
          ${blocks}
        </td>
      </tr>
    </table>
  </td>
</tr>`;
};

/**
 * The dark closing band.
 *
 * The call to action sits here rather than stacked into the body, so it always
 * ends up in the same place — the last thing above the footer — no matter how
 * much detail the sections above carried.
 */
const close = (t: EmailTheme, c: MessageClose): string => {
  if (!c.button && !c.title && !c.note) return "";

  const parts = [
    c.eyebrow ? pill(t, c.eyebrow) : "",
    c.title ? headline(t, c.title, c.accentWord, "light", 22) : "",
    c.lead
      ? `<p style="margin:0 auto;max-width:400px;font-family:${t.sans};font-size:14px;line-height:1.6;color:${t.body};">${c.lead}</p>`
      : "",
    c.button ? button(t, c.button.label, c.button.href) : "",
    c.note ? `<div style="max-width:400px;margin:0 auto;">${note(t, c.note)}</div>` : "",
  ].filter(Boolean);

  // On the light surface, not on the footer's dark backdrop.
  //
  // The call to action lived inside the dark band for two passes. It put the
  // one thing the reader is meant to click on top of a textured, glowing
  // field — the busiest background in the message under its most important
  // element — and it pulled the pill, headline and fine print into a
  // treatment meant to be the sign-off, not the content. The glow now belongs
  // to the footer alone, and the action stays with the message.
  return `
<tr>
  <td class="pad" align="center" style="padding:${PAD.close}px ${PAD.gutter}px;background-color:${t.surface};border-top:1px solid ${t.hairline};text-align:center;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${parts
        .map(
          (p, i) =>
            `<tr><td align="center" style="padding-top:${i === 0 ? 0 : 18}px;text-align:center;">${p}</td></tr>`
        )
        .join("")}
    </table>
  </td>
</tr>`;
};

/**
 * The closing band's backdrop, as one SVG.
 *
 * The home page draws this with two stacked absolutely-positioned layers:
 *
 *   bg-primary/15 blur-[120px]        a 720×420 ellipse centred on the top edge
 *   radial-gradient(circle at 1px…)   a white/9% dot grid at a 28px step
 *
 * Neither survives in email. CSS `filter: blur()` does not exist there, and
 * Outlook's Word engine ignores CSS gradients outright — which is why the
 * first attempt skipped the glow entirely and the band came out flat black.
 *
 * SVG has a real `radialGradient`, and an SVG data URI is just an image, so
 * the blurred ellipse and the dot pattern are both drawn properly and shipped
 * as one background. One image rather than two stacked `background-image`
 * layers, because multiple backgrounds are unevenly supported and the glow is
 * the half that matters.
 *
 * Built from `t.primary` at render time, so it tracks the configured brand
 * colour like everything else. Still progressive enhancement: a client that
 * drops data URIs falls back to the flat `background-color` beside it.
 */
const deepBackdrop = (t: EmailTheme): string => {
  // Sized to the footer alone now that the call to action has moved out.
  // It matters: the dot mask is centred at 50% of this height, so a backdrop
  // much taller than the cell puts the texture's centre below the fold and
  // the visible part comes out uniformly faded.
  const H = 320;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${H}" preserveAspectRatio="none">` +
    `<defs>` +
    // The glow. `w-[720px] h-[420px]` centred on the top edge is a 360×210
    // ellipse below it, so the gradient is a 370 circle squashed to 0.57 in y
    // rather than a plain circle — a circular glow reads as a dome and sits
    // too high.
    `<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="300" cy="0" r="370" gradientTransform="matrix(1,0,0,0.57,0,0)">` +
    `<stop offset="0%" stop-color="${t.primary}" stop-opacity="0.16"/>` +
    `<stop offset="42%" stop-color="${t.primary}" stop-opacity="0.07"/>` +
    `<stop offset="76%" stop-color="${t.primary}" stop-opacity="0.015"/>` +
    `<stop offset="100%" stop-color="${t.primary}" stop-opacity="0"/>` +
    `</radialGradient>` +
    // The dot grid's own mask — `maskImage: radial-gradient(ellipse 70% 60% at
    // 50% 50%, black, transparent)`, which fades the texture out at the edges
    // so it never reaches a hard boundary.
    `<radialGradient id="mg" cx="50%" cy="50%" r="72%">` +
    `<stop offset="0%" stop-color="#ffffff"/>` +
    `<stop offset="60%" stop-color="#ffffff" stop-opacity="0.55"/>` +
    `<stop offset="100%" stop-color="#000000"/>` +
    `</radialGradient>` +
    `<mask id="m"><rect width="600" height="${H}" fill="url(#mg)"/></mask>` +
    // 0.09 × the layer's own `opacity-[0.35]`. Taking the 0.09 at face value
    // and skipping the wrapper is what made the first version read as a
    // visible grid rather than a texture.
    `<pattern id="d" width="28" height="28" patternUnits="userSpaceOnUse">` +
    `<circle cx="1" cy="1" r="1" fill="#ffffff" fill-opacity="0.032"/>` +
    `</pattern>` +
    `</defs>` +
    `<rect width="600" height="${H}" fill="${t.deep}"/>` +
    `<rect width="600" height="${H}" fill="url(#g)"/>` +
    `<rect width="600" height="${H}" fill="url(#d)" mask="url(#m)"/>` +
    `</svg>`;

  // `encodeURIComponent` escapes the SVG's double quotes to %22, so the whole
  // value survives inside a double-quoted style attribute; `url()` is then
  // single-quoted, and the SVG contains no single quotes to collide with it.
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
};

/**
 * The wordmark, with its last word in the brand colour.
 *
 * Straight from `footer.tsx`, which sets the final word of the site name in
 * primary — "Kerala Samajam <Augsburg>". It is the site footer's one piece of
 * identity styling, and carrying it here is most of what makes the bottom of
 * the message feel like the bottom of the page.
 *
 * On #0f0f0f the brand colour clears 3:1, which is the bar for text this size
 * and weight; the surrounding words are pure white and carry the legibility.
 */
const wordmark = (t: EmailTheme, siteName: string): string => {
  const words = siteName.trim().split(/\s+/);
  if (words.length < 2) return esc(siteName);
  const last = words.pop() as string;
  return `${esc(words.join(" "))} <span style="color:${t.primary};">${esc(last)}</span>`;
};

/**
 * The footer: dark, continuous with the closing band above it.
 *
 * The home page ends on `surface-deep` and the message does the same, so the
 * call to action and the footer read as one closing block rather than as a
 * dark band with a pale strip stuck underneath. A hairline separates them,
 * matching the `border-t` the site footer draws.
 *
 * Deliberately short. The registered name and address identify the sender, and
 * the Impressum link carries everything § 5 DDG actually requires — the
 * Registergericht, the Vereinsregister number and the § 26 BGB board. Putting
 * those in every ticket and receipt made the footer taller than some of the
 * messages above it, for four lines of registry detail nobody reads.
 */
const footer = (t: EmailTheme, ctx: MessageContext): string => {
  const l = ctx.legal;
  const origin = siteOrigin();

  // Placeholders like `{{PLZ}}` survive in a freshly-seeded config. Printing
  // them in a member-facing footer looks worse than omitting the line.
  const real = (v?: string) => (v && !/\{\{.*\}\}/.test(v) ? v : "");

  const addressLine = [real(l.street), [real(l.postalCode), real(l.city)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  const navLink = (href: string, label: string) =>
    `<a href="${escUrl(href)}" style="color:${t.deepInk};text-decoration:none;font-weight:600;">${label}</a>`;
  const legalLink = (href: string, label: string) =>
    `<a href="${escUrl(href)}" style="color:${t.deepBody};text-decoration:underline;">${label}</a>`;
  const sep = `<span style="color:${t.deepEdge};">&nbsp;·&nbsp;</span>`;

  const identity = [
    real(l.entityName) ? esc(real(l.entityName)) : "",
    addressLine ? esc(addressLine) : "",
  ]
    .filter(Boolean)
    .join(sep);

  const links = [
    `<a href="mailto:${esc(ctx.contactEmail)}" style="color:${t.deepBody};text-decoration:underline;">${esc(ctx.contactEmail)}</a>`,
    legalLink(origin + "/legal/imprint", "Impressum"),
    legalLink(origin + "/legal/privacy", "Datenschutz"),
    ctx.unsubscribeUrl ? legalLink(ctx.unsubscribeUrl, "Unsubscribe") : "",
  ]
    .filter(Boolean)
    .join(sep);

  // Inner content only; the dark cell is shared with the call to action above.
  return `
    <p style="margin:0 0 18px;font-family:${t.sans};font-size:17px;font-weight:800;line-height:1.25;letter-spacing:-0.035em;color:${t.deepInk};">
      ${wordmark(t, ctx.siteName)}
    </p>
    <p style="margin:0 0 20px;font-family:${t.sans};font-size:12.5px;line-height:1.45;color:${t.deepInk};">
      ${navLink(origin + "/events", "Events")}${sep}${navLink(origin + "/gallery", "Gallery")}${sep}${navLink(origin + "/membership", "Membership")}${sep}${navLink(origin + "/contact", "Contact")}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
      <tr><td width="30" style="width:30px;height:1px;line-height:1px;font-size:0;background-color:${t.deepEdge};">&nbsp;</td></tr>
    </table>
    <p style="margin:0;font-family:${t.sans};font-size:11px;line-height:1.7;color:${t.deepBody};">
      ${identity ? `${identity}<br/>` : ""}${links}<br/><span style="color:${t.deepMuted};">© ${new Date().getFullYear()} ${esc(ctx.siteName)}</span>
    </p>`;
};

/**
 * The dark footer, and the only thing carrying the glow.
 *
 * One cell, so the backdrop is drawn once and anchored to the top of the dark
 * region. Splitting it across rows painted the glow twice, with a second flare
 * partway down.
 */
const closing = (t: EmailTheme, ctx: MessageContext): string => `
<tr>
  <td class="pad deep" align="center" style="padding:36px ${PAD.gutter}px 30px;background-color:${t.deep};background-image:${deepBackdrop(t)};background-repeat:no-repeat;background-position:center top;text-align:center;">
    ${footer(t, ctx)}
  </td>
</tr>`;

/** Render a full message. */
export function renderMessage(ctx: MessageContext, m: Message): string {
  const t = buildTheme(ctx.branding);
  const sections = m.sections.filter((s) => s.blocks.some((b) => !!b));

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <!--
    Light only, declared — matching the site, which has no theme switcher and
    never applies a dark class.

    The previous version declared "light dark" and shipped a prefers-color-scheme
    block that repainted the backgrounds dark while leaving every text colour
    inlined at its light value. The result was #1c1a19 ink on a #212127 band:
    an invisible receipt. Completing the dark palette would not have fixed it
    either, because Gmail drops the style block on forward and several
    corporate filters strip it outright — so the half-inverted state would
    still have reached a good share of recipients.

    Declared light-only, clients that honour it leave the message alone, and
    the ones that force-invert regardless (Gmail app, Outlook.com) run their
    own inversion, which flips foreground and background together and stays
    legible.
  -->
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${esc(m.subject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <!-- Manrope only. Apple Mail and iOS honour this link; Gmail and Outlook
       strip it and fall back to the system sans in the inline stacks below.
       The accent word is a colour, not a second face, so nothing here degrades
       into a different voice. -->
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style type="text/css">
    /*
      Progressive enhancement only. Everything structural is inlined, because
      Gmail drops this block on forward and several corporate filters strip it
      outright — a layout that depends on it is a layout that sometimes fails.
    */
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
    body { margin:0 !important; padding:0 !important; width:100% !important; }

    /* Apple/iOS auto-links dates, addresses and phone numbers in its own blue. */
    a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; font-size:inherit !important; font-family:inherit !important; font-weight:inherit !important; line-height:inherit !important; }

    @media screen and (max-width:620px) {
      .card { width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
      .pad { padding-left:${PAD.gutterMobile}px !important; padding-right:${PAD.gutterMobile}px !important; }
      /* The panel is inset from the card and padded again inside, so on a
         narrow screen both have to give way or the text column collapses. */
      .inset { padding-left:${PAD.insetMobile}px !important; padding-right:${PAD.insetMobile}px !important; }
      .panel { padding-left:${PAD.panelXMobile}px !important; padding-right:${PAD.panelXMobile}px !important; }
      .shell { padding:0 !important; }
      h1 { font-size:25px !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:${t.canvas};">
  ${preheader(m.previewText)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background-color:${t.canvas};">
    <tr>
      <td align="center" class="shell" style="padding:32px 12px;">
        <table role="presentation" class="card" width="${LAYOUT.width}" cellpadding="0" cellspacing="0" border="0" style="width:${LAYOUT.width}px;max-width:${LAYOUT.width}px;background-color:${t.surface};border:1px solid ${t.hairline};border-radius:${t.radius};overflow:hidden;">
          <!-- The brand bar. Four pixels of colour that identify the sender
               before anything has loaded, and the one element that still shows
               who sent this when images are blocked. -->
          <tr><td style="height:4px;line-height:4px;font-size:0;background-color:${t.primary};">&nbsp;</td></tr>
          ${masthead(t, ctx)}
          ${hero(t, m)}
          ${sections.map((s, i) => section(t, s, i)).join("")}
          ${m.close ? close(t, m.close) : ""}
          ${closing(t, ctx)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Convenience for templates: theme, plus the context they were handed. */
export const themed = (ctx: MessageContext): EmailTheme => buildTheme(ctx.branding);
