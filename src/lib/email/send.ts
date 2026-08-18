/**
 * The policy layer: who is allowed to receive what, what gets recorded, and
 * what the caller is told.
 *
 * Every send in the application goes through `sendMail`. That is what makes an
 * undelivered ticket visible in `/admin/emails` instead of being a console
 * line on a server nobody reads, and what lets a scheduled job run twice
 * without mailing everybody twice.
 */

import { nanoid } from "nanoid";

import { prisma } from "../prisma";
import { getConfig } from "../config-utils";
import type { NotificationEmailConfig } from "../config-schema";
import type { Message, MessageContext } from "./shell";
import { renderMessage } from "./shell";

/**
 * The rendering context handed to every template.
 *
 * Kept as an alias so callers outside this module — `getEmailContext`'s
 * consumers, the cron jobs — did not all have to be renamed when the old shell
 * was retired.
 */
export type EmailContext = MessageContext;
import { deliver, type TransportAttachment } from "./transport";
import { siteOrigin } from "./tokens";

/**
 * `template` → the settings switch that gates it, for mail sent as a direct
 * result of something a member or admin does (as opposed to `automated`'s
 * cron jobs, which already gate themselves before this layer is reached —
 * see `email-jobs.ts`).
 *
 * A template with no entry here always sends: that is the deliberate list of
 * security mail (verification, password reset, sign-in/email-change alerts)
 * and GDPR-mandated notices, which is not optional. Keep this in sync with
 * `NotificationEmailConfig` in `config-schema.ts`.
 */
const NOTIFICATION_TOGGLE: Record<string, keyof NotificationEmailConfig> = {
  "event.ticket": "eventTicket",
  "event.registration-cancelled": "eventRegistrationChanges",
  "event.registration-cancelled.admin": "eventRegistrationChanges",
  "event.registration-removed": "eventRegistrationChanges",
  "event.cancelled": "eventCancelledBroadcast",
  "event.reinstated": "eventCancelledBroadcast",
  "event.rescheduled": "eventRescheduled",
  "event.full": "eventFull",
  "event.announcement": "eventAnnouncement",
  "payment.event-recorded": "eventPaymentUpdates",
  "payment.event-reverted": "eventPaymentUpdates",
  "membership.student-application-received": "membershipApplicationReceived",
  "membership.application-received": "membershipApplicationReceived",
  "membership.application-admin-notice": "membershipApplicationReceived",
  "membership.student-verified": "membershipApplicationDecision",
  "membership.application-rejected": "membershipApplicationDecision",
  "membership.active": "membershipActivation",
  "membership.renewed": "membershipActivation",
  "gallery.contribution-admin-notice": "galleryContributions",
  "gallery.contribution-approved": "galleryContributions",
  "gallery.contribution-rejected": "galleryContributions",
  "contact.admin-notice": "contactForm",
  "contact.acknowledgement": "contactForm",
};

/**
 * What a template returns.
 *
 * Templates describe the message — eyebrow, title, lead, panels — and the
 * shell decides how it is framed.
 */
export type TemplateOutput = Message;

/**
 * What kind of mail this is, which decides whether a member can turn it off.
 *
 * `transactional` covers anything a recipient needs in order to act or to have
 * a record: tickets, receipts, password resets, cancellation notices, GDPR
 * responses. It is never suppressed and never carries an unsubscribe link.
 */
export type EmailCategory = "transactional" | "announcement" | "reminder" | "newsletter";

const PREFERENCE_FIELD: Record<Exclude<EmailCategory, "transactional">, keyof PreferenceRow> = {
  announcement: "emailEventAnnouncements",
  reminder: "emailEventReminders",
  newsletter: "emailNewsletter",
};

interface PreferenceRow {
  id: string;
  emailEventAnnouncements: boolean;
  emailEventReminders: boolean;
  emailNewsletter: boolean;
  unsubscribeToken: string | null;
}

export interface SendMailOptions {
  /** Stable identifier, e.g. `event.ticket`. Used for the log and for `once`. */
  template: string;
  to: string;
  /** The row this concerns — registration, subscription, user or event id. */
  entityId?: string;
  category?: EmailCategory;
  attachments?: TransportAttachment[];
  /**
   * Send at most one of this `(template, entityId)` pair, ever.
   *
   * The scheduled jobs rely on this. A cron that fires twice — a retry, an
   * overlapping run, a redeploy — would otherwise send every member their
   * "membership expires in 30 days" notice twice.
   */
  once?: boolean;
  /** Build the message. Receives the context so templates stay pure. */
  build: (ctx: EmailContext) => TemplateOutput;
  /**
   * Rewrite the rendered HTML before it is written to `EmailLog.html`, on top
   * of the pattern-based redaction (see `redactCredentialsForStorage` below)
   * that already runs unconditionally on every send. What is actually
   * delivered is never touched — this only changes the stored copy.
   *
   * `getEmailHtml` (`email-admin-actions.ts`) lets anyone holding
   * `email.view` — a much lower bar than whatever permission sent the mail —
   * read a stored message back, and the retention window (90 days) outlives
   * plenty of short-lived credentials (an invite token's 72 hours, for one).
   *
   * Most templates need nothing beyond the automatic redaction. This exists
   * for a credential shape the pattern-based pass does not already know
   * about — an admin inspecting an ordinary template still needs the real
   * body, not a guess at what might be sensitive.
   */
  redactForStorage?: (html: string) => string;
}

export interface SendMailResult {
  ok: boolean;
  /** True when the recipient has opted out, or `once` already matched. */
  skipped?: boolean;
  reason?: string;
  error?: string;
  logId?: string;
}

/**
 * Build the rendering context from site settings.
 *
 * `getConfig` is React-cached per request, so calling this once per email in a
 * loop costs one query for the whole batch.
 */
export async function getEmailContext(unsubscribeUrl?: string): Promise<EmailContext> {
  const config = await getConfig();
  return {
    siteName: config.siteName,
    contactEmail: config.contactEmail,
    branding: {
      logoUrl: config.branding.logoUrl,
      siteName: config.siteName,
      primaryColor: config.branding.primaryColor,
    },
    legal: config.legal,
    unsubscribeUrl,
  };
}

/**
 * The `From` header.
 *
 * The display name comes from settings — that field was previously validated,
 * saved, and then never read by anything. The *address* still prefers
 * `EMAIL_FROM`, because it has to belong to a domain verified with the sending
 * provider, and that is a deployment fact rather than something an
 * administrator should be able to break by typing into a form. When no
 * environment value is set the configured address is used, so a deployment
 * that never sets one still works.
 */
export function buildFrom(config: {
  siteName: string;
  email: { fromName: string; fromEmail: string };
}): string {
  const envValue = process.env.EMAIL_FROM?.trim();
  // `EMAIL_FROM` may itself be `Name <addr>`; take only the address from it.
  const envAddress = envValue?.match(/<([^>]+)>/)?.[1]?.trim() || envValue;
  const address = envAddress || config.email.fromEmail;
  const name = (config.email.fromName || config.siteName || "").replace(/["\\]/g, "");
  return name ? `"${name}" <${address}>` : address;
}

/**
 * A plain-text alternative, derived from the HTML.
 *
 * Not decoration: a multipart message scores better with spam filters than a
 * bare HTML one, and a text/plain part is the only thing some accessibility
 * tooling and smartwatch clients will render at all.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = String(label).replace(/<[^>]+>/g, "").trim();
      return href && !href.startsWith("#") && text ? `${text} (${href})` : text;
    })
    .replace(/<\/(p|div|tr|h1|h2|h3|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The placeholder every credential redaction collapses to, whatever shape the
 * link took. Kept in one constant so the two mechanisms that redact storage
 * — this pattern-based pass and a template's own narrow `redactForStorage`
 * (`redactInviteLink` in `staff-actions.ts`, notably) — read the same way in
 * an admin's inbox instead of one looking like a bug next to the other.
 *
 * Deliberately not a valid URL fragment (spaces, an em dash, brackets): it
 * must be obvious at a glance that this could never be followed, not just
 * that the value looks unfamiliar.
 */
const REDACTED = "token withheld from the stored copy";

/**
 * True when a stored body has had a credential link redacted out of it —
 * by the automatic pattern-based pass below, by a template's own
 * `redactForStorage`, or both. `resendEmail` (`email-admin-actions.ts`) uses
 * this to refuse re-delivering a body whose links no longer work: matching
 * the placeholder rather than the template name means it catches every
 * redacted send, including ones added after this check was written.
 */
export function wasRedactedForStorage(html: string): boolean {
  return html.includes(REDACTED);
}

/**
 * Strip credential values out of rendered HTML before it is written to
 * `EmailLog.html`. Runs on *every* send, unconditionally — unlike
 * `redactForStorage`, which a template has to opt into — so a future
 * template that grows a credential-bearing link is covered the moment it
 * ships, not whenever its author remembers to ask for it.
 *
 * Two shapes are known to carry one today:
 *
 *  - a `token` query parameter, on any URL (password reset, email
 *    verification, the one-click unsubscribe link) — matched by parameter
 *    name so `?tokenCount=3` or `?apiToken=x` are left alone;
 *  - the path segment right after `/admin/invite/` (the staff invite link).
 *
 * Both regexes are global: the invite template's button renders the same
 * link twice — once in the Outlook VML fallback, once in the real `<a>` —
 * and a first-match-only replace would leave the second copy live. Only the
 * credential itself is swapped out; the surrounding markup, and the rest of
 * the URL (host, path, other params), is left as-is so a reviewer can still
 * see there was a link and where it pointed.
 *
 * This runs *before* any caller-supplied `redactForStorage`, so a callback
 * that still matches on the raw token (as `redactInviteLink` does) simply
 * finds nothing left to replace — a harmless no-op — rather than the two
 * passes fighting over the same substring.
 */
function redactCredentialsForStorage(html: string): string {
  return html
    .replace(/([?&](?:amp;)?token=)[^&"'<>\s]+/gi, `$1[link — ${REDACTED}]`)
    .replace(/(\/admin\/invite\/)[^"'<>\s]+/gi, `$1[invite link — ${REDACTED}]`);
}

/** Mint an unsubscribe token on first need rather than backfilling every row. */
async function unsubscribeTokenFor(user: PreferenceRow): Promise<string> {
  if (user.unsubscribeToken) return user.unsubscribeToken;
  const token = nanoid(32);
  await prisma.user.update({ where: { id: user.id }, data: { unsubscribeToken: token } });
  return token;
}

export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  const category = options.category || "transactional";
  const to = options.to?.trim();

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: `Refusing to send to an invalid address: "${options.to}"` };
  }

  // --- Notification toggle -------------------------------------------------
  const toggleKey = NOTIFICATION_TOGGLE[options.template];
  if (toggleKey) {
    const config = await getConfig();
    if (!config.email.notifications[toggleKey]) {
      await prisma.emailLog.create({
        data: {
          template: options.template,
          to,
          subject: "(suppressed)",
          status: "SUPPRESSED",
          entityId: options.entityId,
          error: `Disabled in Settings → Email (${toggleKey})`,
        },
      });
      return { ok: true, skipped: true, reason: "Disabled in settings" };
    }
  }

  // --- Idempotency --------------------------------------------------------
  if (options.once && options.entityId) {
    const already = await prisma.emailLog.findFirst({
      where: { template: options.template, entityId: options.entityId, status: "SENT" },
      select: { id: true },
    });
    if (already) {
      return { ok: true, skipped: true, reason: "Already sent", logId: already.id };
    }
  }

  // --- Preferences --------------------------------------------------------
  let unsubscribeUrl: string | undefined;
  if (category !== "transactional") {
    const user = await prisma.user.findUnique({
      where: { email: to },
      select: {
        id: true,
        emailEventAnnouncements: true,
        emailEventReminders: true,
        emailNewsletter: true,
        unsubscribeToken: true,
      },
    });

    if (user) {
      if (!user[PREFERENCE_FIELD[category]]) {
        await prisma.emailLog.create({
          data: {
            template: options.template,
            to,
            subject: "(suppressed)",
            status: "SUPPRESSED",
            entityId: options.entityId,
            error: `Recipient has opted out of ${category} email`,
          },
        });
        return { ok: true, skipped: true, reason: `Opted out of ${category}` };
      }
      const token = await unsubscribeTokenFor(user);
      unsubscribeUrl = `${siteOrigin()}/unsubscribe?token=${token}&c=${category}`;
    }
  }

  // --- Render -------------------------------------------------------------
  const config = await getConfig();
  const ctx = await getEmailContext(unsubscribeUrl);

  let built: TemplateOutput;
  let html: string;
  try {
    built = options.build(ctx);
    html = renderMessage(ctx, built);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[email] ${options.template} failed to render:`, error);
    const log = await prisma.emailLog.create({
      data: {
        template: options.template,
        to,
        subject: "(render failed)",
        status: "FAILED",
        entityId: options.entityId,
        error: `Render error: ${message}`,
      },
    });
    return { ok: false, error: message, logId: log.id };
  }

  // `html` itself is untouched and is what `deliver` below actually sends —
  // only the copy written to the log goes through redaction, so neither the
  // automatic pass nor a caller-supplied `redactForStorage` can ever
  // accidentally break delivery.
  //
  // Pattern-based redaction runs first, against the pristine render, so a
  // caller's own `redactForStorage` — which typically matches the literal
  // raw token, as `redactInviteLink` does — runs against text that has
  // already had that same substring removed and safely finds nothing left to
  // do, instead of the two passes colliding mid-string.
  let storedHtml = redactCredentialsForStorage(html);
  if (options.redactForStorage) storedHtml = options.redactForStorage(storedHtml);

  const log = await prisma.emailLog.create({
    data: {
      template: options.template,
      to,
      subject: built.subject,
      status: "QUEUED",
      entityId: options.entityId,
      html: storedHtml,
    },
  });

  // --- Deliver ------------------------------------------------------------
  const result = await deliver({
    to,
    from: buildFrom(config),
    replyTo: config.contactEmail,
    subject: built.subject,
    html,
    text: htmlToText(html),
    attachments: options.attachments,
    headers: unsubscribeUrl
      ? {
          // Gmail and Yahoo require these of anyone sending in volume, and
          // they put the opt-out in the client's own UI, which is where a
          // recipient looks before they reach for "report spam".
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
  });

  await prisma.emailLog.update({
    where: { id: log.id },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      provider: result.provider,
      providerId: result.providerId,
      error: result.error,
      attempts: result.attempts,
      sentAt: result.ok ? new Date() : null,
    },
  });

  if (!result.ok) {
    console.error(`[email] ${options.template} → ${to} FAILED: ${result.error}`);
  }

  return { ok: result.ok, error: result.error, logId: log.id };
}

/**
 * Fan a template out to many recipients.
 *
 * Sequential on purpose. Resend's default rate limit is two requests a second;
 * a `Promise.all` over ninety registrants trips it immediately and the retry
 * backoff then makes the whole broadcast slower than doing it in order. The
 * small gap keeps us inside the limit without relying on retries.
 */
export async function sendMailBatch(
  recipients: Array<Omit<SendMailOptions, "template" | "category" | "once"> & { to: string }>,
  shared: Pick<SendMailOptions, "template" | "category" | "once">
): Promise<{ sent: number; skipped: number; failed: number; errors: string[] }> {
  const summary = { sent: 0, skipped: 0, failed: 0, errors: [] as string[] };

  for (const [index, recipient] of recipients.entries()) {
    if (index > 0) await new Promise((r) => setTimeout(r, 550));
    const result = await sendMail({ ...shared, ...recipient });
    if (result.skipped) summary.skipped++;
    else if (result.ok) summary.sent++;
    else {
      summary.failed++;
      if (result.error && summary.errors.length < 5) summary.errors.push(`${recipient.to}: ${result.error}`);
    }
  }

  return summary;
}
