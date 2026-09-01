import { NextRequest, NextResponse } from "next/server";

import { fetchReels, recordSyncError } from "@/lib/instagram";

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

// There is no "token-refresh" job here anymore. It used to call
// lib/instagram.ts's `refreshLongLivedToken` on a schedule — the correct
// mechanism for the standalone Instagram-Login OAuth flow's short-lived
// `IGAA…` tokens, but wrong for the Business System User's `EAA…` token this
// app now uses, which doesn't expire. Leaving that job wired up was the
// actual root cause of a 2026-09-01 outage: it kept firing, its "success"
// path overwrote InstagramSyncState.accessToken with a refreshed legacy
// IGAA token, and `getAccessToken()` (at the time) preferred that DB value
// over env — silently reintroducing the host/token mismatch instagram.ts's
// file comment warns about. `getAccessToken()` now reads
// `INSTAGRAM_ACCESS_TOKEN` from env only, so nothing rotates it and nothing
// needs to. `isTokenRefreshDue`/`refreshLongLivedToken` are kept in
// lib/instagram.ts (not deleted) for if this ever moves back to the OAuth
// flow they were built for.
const JOBS: Record<string, () => Promise<JobOutcome>> = {
  sync: runSync,
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
