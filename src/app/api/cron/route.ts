import { NextRequest, NextResponse } from "next/server";

import {
  runAdminDigest,
  runEmailLogRetention,
  runEventReminders,
  runMembershipLifecycle,
  runPaymentReminders,
  runPostEventThankYou,
  type JobResult,
} from "@/lib/email-jobs";

/**
 * The scheduled-email endpoint.
 *
 * One route rather than five, because every job is a daily sweep over a small
 * number of rows and splitting them costs five secrets to rotate, five
 * schedules to keep in step, and five chances for one to be quietly forgotten.
 * `?job=` runs a single one when something needs re-running by hand.
 *
 * Authentication is a bearer secret, not a session: the caller is a scheduler,
 * and this endpoint can mail the entire membership.
 */

export const dynamic = "force-dynamic";
// Broadcasts are paced at ~2 sends a second to stay inside the provider's rate
// limit, so a busy day genuinely takes minutes rather than seconds.
export const maxDuration = 300;

const JOBS: Record<string, () => Promise<JobResult | JobResult[]>> = {
  "event-reminders": runEventReminders,
  "post-event": runPostEventThankYou,
  "membership-lifecycle": runMembershipLifecycle,
  "payment-reminders": runPaymentReminders,
  "admin-digest": runAdminDigest,
  "log-retention": runEmailLogRetention,
};

function authorise(request: NextRequest): string | null {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    // Refusing is the only safe answer. Running unauthenticated would leave a
    // public URL that mails every member on demand, and defaulting to "open
    // because it is not configured" is how that happens by accident.
    return "CRON_SECRET is not set. Set it in the environment before scheduling this endpoint.";
  }

  const header = request.headers.get("authorization");
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; the query form is
  // for schedulers that cannot set headers.
  const provided =
    header?.replace(/^Bearer\s+/i, "").trim() ||
    request.nextUrl.searchParams.get("secret")?.trim();

  if (provided !== secret) return "Unauthorized";
  return null;
}

async function run(request: NextRequest) {
  const denied = authorise(request);
  if (denied) {
    return NextResponse.json({ error: denied }, { status: denied === "Unauthorized" ? 401 : 500 });
  }

  const requested = request.nextUrl.searchParams.get("job");
  const names = requested ? [requested] : Object.keys(JOBS);

  const unknown = names.filter((n) => !JOBS[n]);
  if (unknown.length) {
    return NextResponse.json(
      { error: `Unknown job: ${unknown.join(", ")}`, available: Object.keys(JOBS) },
      { status: 400 }
    );
  }

  const started = Date.now();
  const results: JobResult[] = [];

  for (const name of names) {
    try {
      const outcome = await JOBS[name]();
      results.push(...(Array.isArray(outcome) ? outcome : [outcome]));
    } catch (error) {
      // One job failing must not abandon the rest — a broken digest should not
      // stop tomorrow's event reminders going out.
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cron] ${name} failed:`, error);
      results.push({ job: name, sent: 0, skipped: 0, failed: 1, errors: [message] });
    }
  }

  const summary = {
    ok: results.every((r) => !r.errors.length),
    durationMs: Date.now() - started,
    totals: {
      sent: results.reduce((n, r) => n + r.sent, 0),
      skipped: results.reduce((n, r) => n + r.skipped, 0),
      failed: results.reduce((n, r) => n + r.failed, 0),
    },
    results,
  };

  console.info("[cron]", JSON.stringify(summary));
  return NextResponse.json(summary);
}

export async function GET(request: NextRequest) {
  return run(request);
}

/** Some schedulers only issue POST. Same behaviour. */
export async function POST(request: NextRequest) {
  return run(request);
}
