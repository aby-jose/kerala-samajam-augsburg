/**
 * Render the email design system to disk for review.
 *
 * `npm run email:preview` writes one HTML file per message into
 * `.email-preview/`, plus an index that stacks them all in iframes. Every file
 * is the exact HTML that would be sent — the same `renderMessage` the
 * transport calls — so what you scroll through is what lands in the inbox,
 * short of the client's own quirks.
 *
 * The site's real configuration is read from the database, so the brand
 * colour, name, logo and registered address are the association's own rather
 * than invented ones. It falls back to `defaultConfig` when the database is
 * unreachable, so the gallery still renders without a `DATABASE_URL`.
 *
 * This is the prototype harness. It currently carries three representative
 * messages — a ticket (the most complex), a receipt (money) and a one-time
 * code (the sparsest) — written the way real templates will be written.
 *
 * Everything runs inside `main()` because the project emits CommonJS, where
 * top-level `await` is a syntax error.
 */

import "dotenv/config";

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { defaultConfig, type SiteConfig } from "../src/lib/config-schema";
import {
  amount,
  code,
  eventFacts,
  esc,
  facts,
  notice,
  strong,
} from "../src/lib/email/blocks";
import {
  renderMessage,
  themed,
  type Message,
  type MessageContext,
} from "../src/lib/email/shell";
import { absoluteUrl, type EmailTheme } from "../src/lib/email/tokens";

// --- The real site config ----------------------------------------------------

/**
 * Read the live configuration, as `getEmailContext()` does.
 *
 * Queried directly rather than through `getConfig()`, which is wrapped in
 * React's `cache()` and expects a request context.
 */
async function loadConfig(): Promise<{ config: SiteConfig; source: string }> {
  try {
    const { prisma } = await import("../src/lib/prisma");
    const record = await prisma.config.findUnique({ where: { key: "current" } });
    await prisma.$disconnect();

    if (!record?.value) return { config: defaultConfig, source: "defaults (nothing saved)" };

    const stored = record.value as Partial<SiteConfig>;
    return {
      config: {
        ...defaultConfig,
        ...stored,
        branding: { ...defaultConfig.branding, ...stored.branding },
        legal: { ...defaultConfig.legal, ...stored.legal },
      },
      source: "database",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { config: defaultConfig, source: `defaults (${reason})` };
  }
}

// --- The three converted templates -------------------------------------------

const onam = {
  title: "Onam Celebration 2026",
  slug: "onam-2026",
  date: new Date("2026-09-12T17:00:00Z"),
  startTime: "17:00",
  endTime: "22:30",
  location: "Zeughaus Augsburg",
  address: "Zeugplatz 4, 86150 Augsburg",
};

const ticket = (t: EmailTheme): Message => ({
  subject: "You're in — Onam 2026, 12 September",
  previewText: "Your place is held. The ticket PDF is attached.",
  eyebrow: "Event ticket",
  title: "You're on the list",
  accentWord: "list",
  lead: `Ammu, your place at ${strong(t, esc(onam.title))} is confirmed. Your ticket is attached as a PDF — keep it on your phone, or bring a printout.`,
  // Two sections, not three. The booking reference belongs beside the event
  // it is for, not in a panel of its own — splitting them added a label, a
  // border and 52px of padding to say nothing the reader was missing.
  sections: [
    {
      label: onam.title,
      blocks: [
        eventFacts(t, onam),
        facts(t, [
          { label: "Ticket", value: "KSA-8F42-9C11", mono: true, emphasis: true },
          { label: "Attendees", value: "4" },
        ]),
      ],
    },
    {
      label: "At the door",
      blocks: [
        amount(t, {
          caption: "Still to pay",
          amount: 36,
          sub: "Your ticket is valid either way — settle up with the desk when you arrive. Cash is fine.",
        }),
      ],
    },
  ],
  close: {
    eyebrow: "See you there",
    button: { label: "View event details", href: absoluteUrl(`/events/${onam.slug}`) },
    note: "Need to change or cancel? You can do that from the event page, or just reply to this email.",
  },
});

const receipt = (t: EmailTheme): Message => ({
  subject: "Payment received — membership active to 31 March 2027",
  previewText: "We have your €45.00. Your receipt is attached.",
  eyebrow: "Receipt",
  title: "Payment received",
  accentWord: "received",
  lead: `Ammu, we have recorded your payment for the ${strong(t, "Family")} membership. It is active from today.`,
  sections: [
    {
      blocks: [
        amount(t, {
          caption: "Paid in full",
          amount: 45,
          sub: "Your receipt is attached as a PDF — keep it for your records.",
        }),
      ],
    },
    {
      label: "Your membership term",
      blocks: [
        facts(t, [
          { label: "Plan", value: "Family" },
          { label: "Member since", value: "1 April 2026" },
          { label: "Valid until", value: "31 March 2027", emphasis: true },
          { label: "Term", value: "12 months" },
          { label: "Reference", value: "KSA-MEM-2026-0417", mono: true },
        ]),
        // Folded in beside the reference it is about, rather than given a
        // panel of its own.
        notice(t, {
          body: "Quote that reference on any bank transfer so we can match your payment without asking you for it.",
        }),
      ],
    },
  ],
  close: {
    eyebrow: "Your account",
    button: { label: "Go to my profile", href: absoluteUrl("/profile") },
    note: "We will remind you before the term is up.",
  },
});

const otp = (t: EmailTheme): Message => ({
  subject: "482913 is your verification code",
  previewText: "Enter it within 10 minutes to continue.",
  eyebrow: "Verification code",
  title: "Your code is below",
  accentWord: "code",
  lead: "Enter this to continue with your membership application. It is valid for 10 minutes.",
  sections: [{ blocks: [code(t, "482913")] }],
  close: {
    note: "If you did not ask for this code, someone may have typed your address by mistake. You can ignore this message.",
  },
});

// --- Render ------------------------------------------------------------------

interface Entry {
  id: string;
  group: string;
  name: string;
  message: Message;
}

async function main() {
  const { config, source } = await loadConfig();

  const ctx: MessageContext = {
    siteName: config.siteName,
    contactEmail: config.contactEmail,
    branding: {
      logoUrl: config.branding.logoUrl,
      siteName: config.siteName,
      // The override exists to check that the derived palette holds at any
      // brand colour (D4). Unset — the normal case — the preview uses the
      // site's own.
      primaryColor: process.env.PREVIEW_BRAND || config.branding.primaryColor,
    },
    legal: config.legal,
  };

  const t = themed(ctx);

  const entries: Entry[] = [
    { id: "events-ticket", group: "Events", name: "ticket", message: ticket(t) },
    {
      id: "payments-membership-received",
      group: "Payments",
      name: "membershipPaymentReceived",
      message: receipt(t),
    },
    { id: "account-otp-code", group: "Account", name: "otpCode", message: otp(t) },
  ];

  const OUT = join(process.cwd(), ".email-preview");
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  for (const entry of entries) {
    writeFileSync(join(OUT, `${entry.id}.html`), renderMessage(ctx, entry.message), "utf8");
  }

  // The index. Deliberately dark and neutral so it cannot be mistaken for part
  // of the design being judged.
  const index = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Email preview — ${esc(ctx.siteName)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 24px 80px;
    background: #0b0b0d; color: #e8e8ea;
    font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .wrap { max-width: 700px; margin: 0 auto; }
  h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 6px; }
  .sub { color: #8a8a92; font-size: 13px; margin: 0 0 36px; }
  .brand { display:inline-block; width:10px; height:10px; border-radius:99px;
           background:${t.primary}; vertical-align:-1px; margin-right:7px; }
  article { margin: 0 0 44px; }
  .meta { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin:0 0 4px; }
  .group { font-size:10px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:#8a8a92; }
  .name  { font-family: ui-monospace, Consolas, monospace; font-size:13px; color:#e8e8ea; }
  .subject { color:#b8b8c0; font-size:13px; margin:0 0 12px; }
  .subject b { color:#e8e8ea; font-weight:600; }
  iframe { width:100%; height:1200px; border:1px solid #26262c; border-radius:12px; background:#fff; display:block; }
  footer { color:#5a5a62; font-size:12px; text-align:center; margin-top:60px; }
</style>
</head>
<body>
<div class="wrap">
  <h1><span class="brand"></span>Email preview</h1>
  <p class="sub">
    ${entries.length} message${entries.length === 1 ? "" : "s"} · brand
    <code>${esc(t.primary)}</code> from ${esc(source)} · bands
    <code>${esc(t.bandA)}</code> and <code>${esc(t.bandB)}</code> · rendered by
    <code>renderMessage</code>, exactly as sent.
    <br />Set <code>PREVIEW_BRAND</code> to check the palette at another brand colour.
  </p>
  ${entries
    .map(
      (e) => `<article>
    <div class="meta"><span class="group">${esc(e.group)}</span><span class="name">${esc(e.name)}</span></div>
    <p class="subject"><b>${esc(e.message.subject)}</b> — ${esc(e.message.previewText)}</p>
    <iframe src="./${e.id}.html" title="${esc(e.name)}" loading="lazy"></iframe>
  </article>`
    )
    .join("\n  ")}
  <footer>Generated by scripts/email-preview.ts</footer>
</div>
</body>
</html>`;

  writeFileSync(join(OUT, "index.html"), index, "utf8");

  console.log(`\n  ${entries.length + 1} files written to .email-preview/`);
  console.log(`  brand ${t.primary} from ${source}\n`);
  console.log(`  open .email-preview/index.html\n`);
  for (const e of entries) console.log(`    ${e.group.padEnd(10)} ${e.name}`);
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
