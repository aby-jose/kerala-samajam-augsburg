/**
 * Fixed-window rate limiting, held in process memory.
 *
 * Consolidates the three near-identical `Map`s that had grown up in
 * `contact-actions`, `event-actions` and elsewhere. Behaviour is unchanged;
 * having one implementation means the move to a shared store is one edit
 * rather than a hunt.
 *
 * Known limitation — this is per-process. Behind more than one instance, or on
 * a serverless platform, each worker keeps its own counters, so the effective
 * limit is `limit × instances` and everything resets on a cold start. That is
 * acceptable for slowing down abuse; it is *not* enough for anything where the
 * limit is the only thing standing between an attacker and an account. Those
 * call sites need the database-backed version.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

/** Stops the map growing without bound in a long-lived process. */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** When the window resets, epoch ms. */
  resetAt: number;
}

/**
 * Consume one unit against `key`. Returns `ok: false` once the window is full.
 *
 * `key` must include whatever you are limiting *per* — a user id, an IP, a
 * ticket id. A constant string makes one global bucket shared by every caller,
 * which is how the AI actions ended up with a single 10/minute allowance for
 * the entire site.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/** Throwing form, for server actions that surface the message to the user. */
export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  message = "Too many requests. Please wait a moment and try again."
) {
  const result = rateLimit(key, limit, windowMs);
  if (!result.ok) throw new Error(message);
  return result;
}

/**
 * Database-backed counter, for the cases the in-memory one cannot cover:
 * sign-in attempts and password reset requests, where the limit is the control
 * standing between an attacker and an account. Shared across every instance
 * and unaffected by restarts.
 *
 * Slower than the in-memory path (two round trips at worst), so use it where
 * the limit matters rather than everywhere.
 */
export async function persistentRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const { prisma } = await import("./prisma");
  const now = new Date();

  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.resetAt <= now) {
    const resetAt = new Date(now.getTime() + windowMs);
    await prisma.rateLimit.upsert({
      where: { key },
      update: { count: 1, resetAt },
      create: { key, count: 1, resetAt },
    });
    return { ok: true, remaining: limit - 1, resetAt: resetAt.getTime() };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt.getTime() };
  }

  const updated = await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return {
    ok: true,
    remaining: Math.max(0, limit - updated.count),
    resetAt: updated.resetAt.getTime(),
  };
}

/** Clear a counter — called after a successful sign-in. */
export async function clearPersistentRateLimit(key: string): Promise<void> {
  const { prisma } = await import("./prisma");
  await prisma.rateLimit.deleteMany({ where: { key } });
}
