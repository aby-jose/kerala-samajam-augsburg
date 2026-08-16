/**
 * The provider layer. One job: hand a message to Resend and report honestly
 * what happened.
 *
 * The version this replaces did three things that between them made every
 * delivery failure invisible:
 *
 *   1. It caught the Resend error, logged it to the console, and then *fell
 *      through* to an SMTP fallback — so the error the caller finally received
 *      described the fallback, not the actual failure.
 *   2. That fallback was configured from `SMTP_HOST` and friends, which are
 *      not set. `createTransport` succeeds with an undefined host and every
 *      `sendMail` then dies with `ESOCKET`, so the reported cause of every
 *      failure was a socket error against a server that was never configured.
 *   3. It returned `{ success: false }` and almost every call site discarded
 *      the result.
 *
 * The fallback is now opt-in — it only exists if `SMTP_HOST` is actually set —
 * and the original error always survives.
 */

import { Resend } from "resend";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface TransportAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface TransportMessage {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: TransportAttachment[];
}

export interface TransportResult {
  ok: boolean;
  provider?: "resend" | "smtp";
  providerId?: string;
  error?: string;
  attempts: number;
}

let resendClient: Resend | null | undefined;
function getResend(): Resend | null {
  if (resendClient === undefined) {
    const key = process.env.RESEND_API_KEY?.trim();
    resendClient = key ? new Resend(key) : null;
  }
  return resendClient;
}

/**
 * Only built when SMTP is actually configured.
 *
 * Constructed lazily rather than at module load: a transporter built from an
 * undefined host is a loaded gun that reports `ESOCKET` for every failure in
 * the system, and the old module built one unconditionally.
 */
let smtpTransport: Transporter | null | undefined;
function getSmtp(): Transporter | null {
  if (smtpTransport === undefined) {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) {
      smtpTransport = null;
    } else {
      const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
      smtpTransport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASSWORD
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
      });
    }
  }
  return smtpTransport;
}

/** Exposed so the settings screen can say which providers are actually live. */
export function transportStatus() {
  return {
    resend: !!process.env.RESEND_API_KEY?.trim(),
    smtp: !!process.env.SMTP_HOST?.trim(),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Worth trying again?
 *
 * A rate limit or a 5xx is the provider having a moment. A 422 for an
 * unverified sending domain will fail identically forever, and retrying it
 * three times just delays the error reaching the log by six seconds.
 */
function isRetryable(error: unknown): boolean {
  const e = error as { statusCode?: number; name?: string; message?: string };
  const status = e?.statusCode;
  if (status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;
  if (e?.name === "rate_limit_exceeded" || e?.name === "application_error") return true;
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed/i.test(e?.message || "");
}

function describe(error: unknown): string {
  if (!error) return "Unknown error";
  const e = error as { name?: string; message?: string; statusCode?: number };
  const parts = [e.name, e.message].filter(Boolean).join(": ");
  return (e.statusCode ? `[${e.statusCode}] ` : "") + (parts || String(error));
}

const MAX_ATTEMPTS = 3;

export async function deliver(message: TransportMessage): Promise<TransportResult> {
  const resend = getResend();
  let attempts = 0;
  let lastError = "";

  if (resend) {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      attempts++;
      try {
        const { data, error } = await resend.emails.send({
          from: message.from,
          to: [message.to],
          replyTo: message.replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
          attachments: message.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })),
        });

        if (error) throw error;
        return { ok: true, provider: "resend", providerId: data?.id, attempts };
      } catch (error) {
        lastError = describe(error);
        if (i < MAX_ATTEMPTS - 1 && isRetryable(error)) {
          await sleep(400 * Math.pow(3, i)); // 0.4s, 1.2s
          continue;
        }
        break;
      }
    }
  } else {
    lastError = "RESEND_API_KEY is not set";
  }

  const smtp = getSmtp();
  if (smtp) {
    attempts++;
    try {
      const info = await smtp.sendMail({
        from: message.from,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
        attachments: message.attachments,
      });
      return { ok: true, provider: "smtp", providerId: info.messageId, attempts };
    } catch (error) {
      // The SMTP failure is appended rather than substituted: the Resend error
      // is almost always the one worth reading.
      lastError = `${lastError} | SMTP fallback: ${describe(error)}`;
    }
  }

  return { ok: false, error: lastError || "No email provider is configured", attempts };
}
