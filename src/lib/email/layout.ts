/**
 * The shell every email is rendered into.
 *
 * The important change from the first version is *where the structure lives*.
 * Previously the layout supplied a card and a footer and left everything above
 * the body to each template, so a message was a single undifferentiated column
 * of blocks and no two templates opened the same way. Now the shell owns the
 * whole skeleton — brand bar, masthead, hero, body, action, footer — and a
 * template supplies content for named slots. A template cannot drift out of
 * the design system because it never gets to decide the frame.
 *
 *   ┌──────────────────────────────────┐
 *   │ ▬▬▬▬ brand bar, tinted by tone   │
 *   ├──────────────────────────────────┤
 *   │ [logo] KERALA SAMAJAM AUGSBURG   │  masthead
 *   ├──────────────────────────────────┤
 *   │ EVENT TICKET                     │  eyebrow  ┐
 *   │ You're on the list               │  title    │ hero
 *   │ Ammu, your place at Onam is …    │  lead     ┘
 *   ├──────────────────────────────────┤
 *   │ ‹cards, notices, prose›           │  body
 *   ├──────────────────────────────────┤
 *   │ [ View event details ]           │  action
 *   │ Need to change or cancel? …      │  note
 *   ├──────────────────────────────────┤
 *   │ Events · Gallery · Membership    │  ┐
 *   │ Kerala Samajam Augsburg e.V. …   │  │ footer
 *   │ Impressum · Datenschutz · © 2026 │  ┘
 *   └──────────────────────────────────┘
 */

import type { LegalEntityConfig } from "../config-schema";
import {
  LAYOUT,
  SPACE,
  buildTheme,
  resolveLogo,
  siteOrigin,
  type EmailBranding,
  type EmailTheme,
} from "./tokens";
import { esc, escUrl, stack, toneColors, type Tone } from "./components";

export interface EmailContext {
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

/**
 * What a template produces.
 *
 * `eyebrow`, `title` and `lead` are rendered by the shell, not by the
 * template, which is what keeps every message opening the same way.
 */
export interface EmailDocument {
  subject: string;
  previewText: string;
  /** Short category label — TICKET, RECEIPT, SECURITY NOTICE. */
  eyebrow: string;
  /** Colours the brand bar and the eyebrow. Defaults to the brand colour. */
  tone?: Tone;
  /** The headline. Plain text; escaped by the shell. */
  title: string;
  /** One or two sentences under the headline. HTML — escape at the call site. */
  lead?: string;
  /** The main blocks, already composed with `stack()`. */
  body?: string;
  /** The primary call to action, from `button()`. */
  action?: string;
  /** Fine print under the action. */
  note?: string;
}

/**
 * Hidden text the inbox shows next to the subject line.
 *
 * Without one, Gmail and Apple Mail pull the first readable text out of the
 * body — which, in the original template, was the logo's alt text, so every
 * message previewed as "Kerala Samajam Augsburg". The trailing entities pad
 * the snippet so no body copy leaks in behind the intended text.
 */
const preheader = (text: string): string =>
  `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(text)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>`;

/**
 * Logo above the wordmark, both centred.
 *
 * The message is a single 600px column with a symmetrical frame, so the
 * masthead sits on its axis rather than pulling to one edge. The logo leads
 * and the name sits beneath it, which is the order the association's own
 * identity is set in.
 */
const masthead = (t: EmailTheme, ctx: EmailContext): string => {
  const logo = resolveLogo(ctx.branding.logoUrl);
  return `
<tr>
  <td class="pad" align="center" style="padding:24px ${LAYOUT.gutter}px 18px;background-color:${t.surface};text-align:center;">
    <a href="${escUrl(siteOrigin())}" style="text-decoration:none;">
      <img src="${esc(logo)}" alt="${esc(ctx.siteName)}" width="52" height="52" style="width:52px;height:52px;display:block;margin:0 auto 10px;border:0;outline:none;" />
      <span style="display:block;font-family:${t.sans};font-size:17px;font-weight:800;line-height:1.3;color:${t.ink};letter-spacing:-0.025em;">${esc(ctx.siteName)}</span>
    </a>
  </td>
</tr>
<tr>
  <td class="pad" align="center" style="padding:0 ${LAYOUT.gutter}px;background-color:${t.surface};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
      <tr><td width="36" style="width:36px;height:2px;line-height:2px;font-size:0;background-color:${t.hairline};">&nbsp;</td></tr>
    </table>
  </td>
</tr>`;
};

/**
 * Eyebrow, headline, lead — centred on the column's axis.
 *
 * No tinted band behind it. White throughout, with the rule above and the
 * eyebrow's colour doing the separating, reads calmer than a grey block and
 * stops the message looking like two documents stacked on each other.
 */
const hero = (t: EmailTheme, doc: EmailDocument): string => {
  const c = toneColors(t, doc.tone || "brand");
  return `
<tr>
  <td class="pad" align="center" style="padding:${SPACE.lg}px ${LAYOUT.gutter}px ${SPACE.sm}px;background-color:${t.surface};text-align:center;">
    <p style="margin:0 0 9px;font-family:${t.sans};font-size:10.5px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${c.fg};">${esc(doc.eyebrow)}</p>
    <h1 style="margin:0;font-family:${t.sans};font-size:26px;line-height:1.18;font-weight:800;color:${t.ink};letter-spacing:-0.035em;">${esc(doc.title)}</h1>
    ${doc.lead ? `<p style="margin:12px auto 0;max-width:430px;font-family:${t.sans};font-size:15px;line-height:1.6;color:${t.body};">${doc.lead}</p>` : ""}
  </td>
</tr>`;
};

/** The cards, callouts and prose. */
const body = (t: EmailTheme, doc: EmailDocument): string => {
  if (!doc.body) return "";
  return `
<tr>
  <td class="pad" style="padding:${SPACE.md}px ${LAYOUT.gutter}px ${SPACE.sm}px;background-color:${t.surface};">
    ${doc.body}
  </td>
</tr>`;
};

/**
 * The call to action, centred at the foot of the message.
 *
 * On its own row rather than stacked into the body, so the button always ends
 * up in the same place — the last thing above the footer — no matter how much
 * detail the template put above it.
 */
const action = (t: EmailTheme, doc: EmailDocument): string => {
  if (!doc.action && !doc.note) return "";
  return `
<tr>
  <td class="pad" align="center" style="padding:${SPACE.md}px ${LAYOUT.gutter}px ${SPACE.lg}px;background-color:${t.surface};text-align:center;">
    ${doc.action || ""}
    ${
      doc.note
        ? `<div style="margin-top:${doc.action ? SPACE.md : 0}px;max-width:430px;margin-left:auto;margin-right:auto;">${doc.note}</div>`
        : ""
    }
  </td>
</tr>`;
};

/**
 * The footer: navigation, then who we are and where the detail lives.
 *
 * Deliberately short. The registered name and address identify the sender,
 * and the Impressum link carries everything § 5 DDG actually requires — the
 * Registergericht, the Vereinsregister number and the § 26 BGB board. Putting
 * those in every ticket and receipt made the footer taller than some of the
 * messages above it, for four lines of registry detail nobody reads.
 *
 * Everything here comes from `config.legal`, so a change of address is a
 * settings edit rather than a code change.
 */
const footer = (t: EmailTheme, ctx: EmailContext): string => {
  const l = ctx.legal;
  const origin = siteOrigin();

  // Placeholders like `{{PLZ}}` survive in a freshly-seeded config. Printing
  // them in a member-facing footer looks worse than omitting the line.
  const real = (v?: string) => (v && !/\{\{.*\}\}/.test(v) ? v : "");

  const addressLine = [real(l.street), [real(l.postalCode), real(l.city)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  const navLink = (href: string, label: string) =>
    `<a href="${escUrl(href)}" style="color:${t.body};text-decoration:none;font-weight:600;">${label}</a>`;
  const legalLink = (href: string, label: string) =>
    `<a href="${escUrl(href)}" style="color:${t.muted};text-decoration:underline;">${label}</a>`;
  const sep = `<span style="color:${t.hairline};">&nbsp;·&nbsp;</span>`;

  // Who we are, and where to find the rest.
  //
  // The register court, Vereinsregister number and the § 26 BGB board are
  // deliberately *not* here. § 5 DDG requires them in the Impressum, and the
  // Impressum is linked on the line below — repeating them in the footer of
  // every ticket and receipt added four lines of registry detail that no
  // recipient reads and that an e.V., unlike a GmbH, has no letterhead duty to
  // carry. They live on `/legal/imprint`, which stays one click away.
  const identity = [
    `<span style="color:${t.body};font-weight:700;">${esc(real(l.entityName) || ctx.siteName)}</span>`,
    addressLine ? esc(addressLine) : "",
  ].filter(Boolean).join(sep);

  const links = [
    `<a href="mailto:${esc(ctx.contactEmail)}" style="color:${t.muted};text-decoration:underline;">${esc(ctx.contactEmail)}</a>`,
    legalLink(origin + "/legal/imprint", "Impressum"),
    legalLink(origin + "/legal/privacy", "Datenschutz"),
    ctx.unsubscribeUrl ? legalLink(ctx.unsubscribeUrl, "Unsubscribe") : "",
  ].filter(Boolean).join(sep);

  return `
<tr>
  <td class="pad foot" style="padding:14px ${LAYOUT.gutter}px;background-color:${t.surfaceAlt};border-top:1px solid ${t.hairline};text-align:center;">
    <p style="margin:0;font-family:${t.sans};font-size:12.5px;line-height:1.45;color:${t.body};">
      ${navLink(origin + "/events", "Events")}${sep}${navLink(origin + "/gallery", "Gallery")}${sep}${navLink(origin + "/membership", "Membership")}${sep}${navLink(origin + "/contact", "Contact")}
    </p>
  </td>
</tr>
<tr>
  <td class="pad foot" style="padding:11px ${LAYOUT.gutter}px 15px;background-color:${t.surfaceAlt};border-top:1px solid ${t.hairline};text-align:center;">
    <p style="margin:0;font-family:${t.sans};font-size:11px;line-height:1.6;color:${t.muted};">
      ${identity}<br/>${links}<br/><span style="color:#b5b5ba;">© ${new Date().getFullYear()} ${esc(ctx.siteName)}</span>
    </p>
  </td>
</tr>`;
};

/** Render a full email document. */
export function renderEmail(ctx: EmailContext, doc: EmailDocument): string {
  const t = buildTheme(ctx.branding);
  const bar = toneColors(t, doc.tone || "brand").bar;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <!--
    Gmail and Outlook.com force-invert light emails unless the message declares
    what it supports. Without these two the tinted bands come out muddy and the
    brand colour shifts, so we opt in to a real dark palette below instead of
    accepting the client's guess.
  -->
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${esc(doc.subject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <!-- Manrope only. Newsreader was linked here for serif headlines that no
       longer exist, which cost every recipient a second font request for a
       face nothing referenced. Apple Mail and iOS honour this link; Gmail and
       Outlook strip it and fall back to the system sans in the inline stacks
       below, which is why the fallback is an ordinary sans and not a serif. -->
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
      .pad { padding-left:${LAYOUT.gutterMobile}px !important; padding-right:${LAYOUT.gutterMobile}px !important; }
      .shell { padding:0 !important; }
      h1 { font-size:25px !important; }
    }

    @media (prefers-color-scheme: dark) {
      .shell, .bg { background-color:#0f0f12 !important; }
      .card { background-color:#1a1a1f !important; border-color:#2b2b33 !important; }
      .card td { border-color:#2b2b33 !important; }
      .foot { background-color:#151519 !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:${t.canvas};">
  ${preheader(doc.previewText)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background-color:${t.canvas};">
    <tr>
      <td align="center" class="shell" style="padding:24px 12px;">
        <table role="presentation" class="card" width="${LAYOUT.width}" cellpadding="0" cellspacing="0" border="0" style="width:${LAYOUT.width}px;max-width:${LAYOUT.width}px;background-color:${t.surface};border:1px solid ${t.hairline};border-radius:${t.radius};overflow:hidden;">
          <!-- The brand bar. Four pixels of colour that identify the sender
               before anything has loaded, and the one element that still shows
               the tone of the message when images are blocked. -->
          <tr><td style="height:4px;line-height:4px;font-size:0;background-color:${bar};">&nbsp;</td></tr>
          ${masthead(t, ctx)}
          ${hero(t, doc)}
          ${body(t, doc)}
          ${footer(t, ctx)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Convenience for templates: theme, plus the context they were handed. */
export const themed = (ctx: EmailContext): EmailTheme => buildTheme(ctx.branding);
