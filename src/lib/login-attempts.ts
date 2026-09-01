/**
 * The stored side of the sign-in challenge: how many times each address and
 * each client has got the password wrong lately.
 *
 * Kept in the database rather than in memory for the same reason the sign-in
 * rate limiter is: an in-process counter is per-worker and resets on every
 * cold start, so an attacker never meets it, while the member on the one
 * warm worker does.
 *
 * Reuses the `RateLimit` table, which is a generic windowed counter — these
 * rows are only distinguished by their `loginfail:` key prefix. The window is
 * managed here rather than by `persistentRateLimit`, because this counter has
 * no ceiling (it keeps counting past the threshold) and its window slides.
 */

import { prisma } from "./prisma";

import { LOGIN_FAILURE_WINDOW_MS, captchaRequiredFor } from "./login-challenge";

/** Whether this attempt has to carry a security code. */
export async function isCaptchaRequired(keys: string[]): Promise<boolean> {
  if (keys.length === 0) return false;

  const rows = await prisma.rateLimit.findMany({
    where: { key: { in: keys }, resetAt: { gt: new Date() } },
  });

  return captchaRequiredFor(rows.map((row) => row.count));
}

/**
 * Count one wrong password against every counter for this attempt.
 *
 * Each failure also pushes the window forward, so a run of attempts keeps the
 * code in place for as long as it lasts plus the window, instead of the code
 * lapsing mid-attack on a window opened by the first try.
 *
 * Failures here are swallowed: this runs on the way to rejecting a sign-in,
 * and a database hiccup must not turn "wrong password" into a 500 that says
 * something different to the person and to the attacker.
 */
export async function recordLoginFailure(keys: string[]): Promise<void> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + LOGIN_FAILURE_WINDOW_MS);

  await Promise.all(
    keys.map(async (key) => {
      const existing = await prisma.rateLimit.findUnique({ where: { key } });

      if (!existing || existing.resetAt <= now) {
        await prisma.rateLimit.upsert({
          where: { key },
          update: { count: 1, resetAt },
          create: { key, count: 1, resetAt },
        });
        return;
      }

      await prisma.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 }, resetAt },
      });
    })
  ).catch(() => {});
}

/**
 * Wipe the counters once the password is right.
 *
 * Cleared on the correct password rather than on a completed sign-in, because
 * this counts password failures — someone whose address is still unconfirmed
 * proved they know the password, and should not be met by a code after they
 * click the link in the email.
 */
export async function clearLoginFailures(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await prisma.rateLimit.deleteMany({ where: { key: { in: keys } } }).catch(() => {});
}
