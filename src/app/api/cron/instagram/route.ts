import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { fetchReels, isTokenRefreshDue, refreshLongLivedToken, recordSyncError } from "@/lib/instagram";
import { sendMail, esc } from "@/lib/email";
import { themed } from "@/lib/email/shell";
import { notice } from "@/lib/email/blocks";
import { adminEmailOrNull } from "@/lib/admin-contact";

/**
 * Instagram sync/token-refresh endpoint.
 *
 * Not folded into the existing `/api/cron` route: that one multiplexes email
 * jobs specifically, and its JobResult shape (sent/skipped/failed email
 * counts) doesn't fit a sync job. Same bearer-secret pattern, separate route.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface JobOutcome {
  job: string;
  ok: boolean;
  message: string;
}

async function runSync(): Promise<JobOutcome> {
  try {
    const result = await fetchReels();
    return { job: "sync", ok: true, message: `created ${result.created}, updated ${result.updated}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordSyncError(message);
    return { job: "sync", ok: false, message };
  }
}

async function runTokenRefresh(): Promise<JobOutcome> {
  try {
    const state = await prisma.instagramSyncState.findUnique({ where: { key: "current" } });
    if (!state?.accessToken) {
      return { job: "token-refresh", ok: true, message: "no token yet — skipped" };
    }
    if (!isTokenRefreshDue(state.tokenExpiresAt)) {
      return { job: "token-refresh", ok: true, message: "not due yet" };
    }

    await refreshLongLivedToken();
    return { job: "token-refresh", ok: true, message: "refreshed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    try {
      const to = adminEmailOrNull();
      if (to) {
        await sendMail({
          template: "instagram.token-refresh-failed",
          to,
          build: (ctx) => {
            const t = themed(ctx);
            return {
              subject: "Instagram token refresh failed",
              previewText: "The Instagram Graph API token could not be refreshed automatically.",
              eyebrow: "System alert",
              title: "Instagram token refresh failed",
              accentWord: "failed",
              sections: [
                {
                  blocks: [
                    notice(t, {
                      title: "What happened",
                      body: `The scheduled refresh job failed: ${esc(message)}. The current token has not expired yet, but this needs attention before it does.`,
                    }),
                  ],
                },
              ],
            };
          },
        });
      }
    } catch (mailError) {
      console.error("[instagram] token-refresh alert failed to send:", mailError);
    }

    return { job: "token-refresh", ok: false, message };
  }
}

const JOBS: Record<string, () => Promise<JobOutcome>> = {
  sync: runSync,
  "token-refresh": runTokenRefresh,
};

function authorise(request: NextRequest): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return "CRON_SECRET is not set. Set it in the environment before scheduling this endpoint.";
  }

  const header = request.headers.get("authorization");
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

  const results = await Promise.all(names.map((name) => JOBS[name]()));

  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
