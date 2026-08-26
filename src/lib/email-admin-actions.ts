"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "./prisma";
import { requirePermission } from "./guards";
import { superAdminEmails } from "./rbac/staff-queries";
import { getConfig } from "./config-utils";
import { EMAIL_LOG_PAGE_SIZE } from "./email-constants";
import {
  buildFrom as senderFor,
  deliver,
  sendMail,
  templates,
  transportStatus,
  wasRedactedForStorage,
} from "./email";

/**
 * The delivery log, as the committee sees it.
 *
 * Its whole reason for existing is that a failed email used to be indis-
 * tinguishable from a delivered one: `sendEmail` swallowed the error, returned
 * a value nobody read, and the member simply never heard from us. A screen
 * that lists failures is what turns "emails are not working" from a report
 * into a diagnosis.
 */

export interface EmailLogRow {
  id: string;
  template: string;
  to: string;
  subject: string;
  status: string;
  provider: string | null;
  providerId: string | null;
  error: string | null;
  attempts: number;
  entityId: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export interface EmailLogPage {
  rows: EmailLogRow[];
  total: number;
  counts: { sent: number; failed: number; suppressed: number; queued: number };
  transport: { resend: boolean; smtp: boolean };
  /** Set when the sending configuration is wrong in a way that guarantees
   *  failure, so the screen can say so instead of showing an empty list. */
  configWarnings: string[];
}

const PAGE_SIZE = EMAIL_LOG_PAGE_SIZE;

export async function getEmailLog(options: { status?: string; search?: string; page?: number } = {}): Promise<EmailLogPage> {
  await requirePermission("email.view");

  const where: Record<string, unknown> = {};
  if (options.status && options.status !== "all") where.status = options.status.toUpperCase();
  if (options.search?.trim()) {
    const q = options.search.trim();
    where.OR = [
      { to: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { template: { contains: q, mode: "insensitive" } },
    ];
  }

  const page = Math.max(1, options.page || 1);

  const [rows, total, sent, failed, suppressed, queued] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        template: true,
        to: true,
        subject: true,
        status: true,
        provider: true,
        providerId: true,
        error: true,
        attempts: true,
        entityId: true,
        createdAt: true,
        sentAt: true,
      },
    }),
    prisma.emailLog.count({ where }),
    prisma.emailLog.count({ where: { status: "SENT" } }),
    prisma.emailLog.count({ where: { status: "FAILED" } }),
    prisma.emailLog.count({ where: { status: "SUPPRESSED" } }),
    prisma.emailLog.count({ where: { status: "QUEUED" } }),
  ]);

  return {
    rows,
    total,
    counts: { sent, failed, suppressed, queued },
    transport: transportStatus(),
    configWarnings: await configWarnings(),
  };
}

/**
 * Faults that guarantee failure, checked up front.
 *
 * These are exactly the conditions that produced the original symptom, so the
 * screen names them rather than leaving somebody to infer them from a wall of
 * identical error strings.
 */
async function configWarnings(): Promise<string[]> {
  const warnings: string[] = [];
  const config = await getConfig();
  const { resend, smtp } = transportStatus();

  if (!resend && !smtp) {
    warnings.push(
      "No email provider is configured. Set RESEND_API_KEY (or SMTP_HOST) in the environment — nothing can be sent until you do."
    );
  }

  const envFrom = process.env.EMAIL_FROM?.trim();
  const address = envFrom?.match(/<([^>]+)>/)?.[1]?.trim() || envFrom || config.email.fromEmail;
  if (!address) {
    warnings.push("No sender address. Set EMAIL_FROM, or fill in the From Email field in Settings.");
  } else if (envFrom && config.email.fromEmail && !envFrom.includes(config.email.fromEmail)) {
    warnings.push(
      `Mail is sent from ${address} (EMAIL_FROM), not ${config.email.fromEmail} as configured in Settings. ` +
        "The environment wins, because the address has to belong to a domain verified with the provider."
    );
  }

  const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || "").trim();
  if (!origin) {
    warnings.push("NEXT_PUBLIC_APP_URL / SITE_URL is not set. Links in emails will point at a guessed domain.");
  } else if (/localhost|127\.0\.0\.1/.test(origin)) {
    warnings.push(
      `NEXT_PUBLIC_APP_URL / SITE_URL is "${origin}". Every button in every email links to localhost and will be dead for recipients.`
    );
  }

  if (!(await superAdminEmails()).length) {
    warnings.push(
      "No Super Admin has an email address on file. Committee notifications have nowhere to go."
    );
  }

  return warnings;
}

/** The message as it was actually sent, for inspection in the admin panel. */
export async function getEmailHtml(id: string): Promise<{ html: string | null; subject: string }> {
  await requirePermission("email.view");
  const log = await prisma.emailLog.findUnique({
    where: { id },
    select: { html: true, subject: true },
  });
  if (!log) throw new Error("Email not found");
  return { html: log.html, subject: log.subject };
}

/**
 * Send a stored message again.
 *
 * Re-delivers byte-for-byte what was rendered the first time rather than
 * re-running the template, so a resend cannot quietly become a different
 * message — and so it still works after the underlying row has changed.
 *
 * It therefore bypasses `sendMail`, whose whole job is to render a document
 * into the shell. Handing it an already-complete document would nest one HTML
 * document inside another. The log row is written here instead so a resend is
 * still recorded like any other send.
 *
 * Attachments are not reproduced; a ticket or invoice is re-issued from its
 * own screen.
 */
export async function resendEmail(id: string) {
  await requirePermission("email.resend");

  const original = await prisma.emailLog.findUnique({ where: { id } });
  if (!original) throw new Error("Email not found");

  // The retention job clears stored bodies after 90 days, so an old row is a
  // record that something was sent rather than a copy of it.
  const storedHtml = original.html;
  if (!storedHtml) {
    throw new Error("The rendered copy of this email is no longer stored, so it cannot be resent.");
  }

  // Every credential-bearing link (password reset, email verification, staff
  // invite, the one-click unsubscribe link) is redacted out of the stored
  // copy at send time — see `redactCredentialsForStorage` in
  // `email/send.ts`. Re-delivering that copy byte-for-byte, which is the
  // whole point of this action, would mail the recipient a dead link while
  // reporting success. Matched by the placeholder itself, not by template
  // name, so this covers every current and future redacted template.
  if (wasRedactedForStorage(storedHtml)) {
    throw new Error(
      "This email's stored copy has a credential link redacted for security and cannot be resent as-is. Trigger a fresh send instead."
    );
  }

  const config = await getConfig();
  const template = `${original.template}.resend`;

  const log = await prisma.emailLog.create({
    data: {
      template,
      to: original.to,
      subject: original.subject,
      status: "QUEUED",
      entityId: original.entityId,
      html: storedHtml,
    },
  });

  const result = await deliver({
    to: original.to,
    from: senderFor(config),
    replyTo: config.contactEmail,
    subject: original.subject,
    html: storedHtml,
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

  revalidatePath("/admin/emails");
  if (!result.ok) throw new Error(result.error || "Resend failed");
  return { success: true };
}

/**
 * Send a specimen of every template to one address.
 *
 * The point is to make a configuration mistake visible in seconds instead of
 * on the next real registration. It also exercises the exact path a live email
 * takes — same transport, same From header, same log — rather than a shortcut
 * that could succeed where the real thing fails.
 */
export async function sendTestEmail(to: string) {
  await requirePermission("email.test");

  const result = await sendMail({
    template: "admin.test",
    to,
    build: (ctx) =>
      templates.account.welcome(ctx, { name: "Test recipient" }),
  });

  if (!result.ok) throw new Error(result.error || "The test email failed to send.");
  return { success: true };
}
