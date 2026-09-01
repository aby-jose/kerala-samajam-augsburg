/**
 * When a sign-in has to be answered with a security code.
 *
 * The code used to be on every attempt, on both portals. That is friction paid
 * by every member on every visit to stop a threat that only shows up in the
 * tail: the scripted attacker grinding a password list. Nothing about the
 * first attempt looks like that attack, and the third one still doesn't —
 * people mistype passwords. So the code is held back until an address, or a
 * client, has failed the password `CAPTCHA_AFTER_FAILURES` times, and from
 * then on it is demanded until things go quiet again.
 *
 * Deliberately free of imports, like `auth-gate`. Both login screens are
 * client components and need the sentinel and the threshold; pulling them from
 * `auth.ts` or `login-attempts.ts` would drag prisma into the browser bundle.
 */

/** The two sign-in doors. Counted separately — they are different audiences. */
export type LoginPortal = "admin" | "public";

/**
 * Sentinel, not prose — same reasoning as `EMAIL_NOT_VERIFIED`.
 *
 * next-auth surfaces whatever `authorize` throws as a bare `result.error`
 * string. The login screens match this value to know they should reveal the
 * code field and let the person try again, and supply their own wording.
 */
export const CAPTCHA_REQUIRED = "CAPTCHA_REQUIRED";

/** Shown as-is when a code was demanded, supplied, and wrong. */
export const INVALID_CAPTCHA_ERROR = "Invalid security code. Please try again.";

/**
 * Failed password attempts allowed before a code is demanded.
 *
 * Three is enough for a mistyped password, a stale saved password and a
 * caps-lock slip — the ordinary ways a member gets it wrong — without giving a
 * script a meaningful budget: it still meets the code on the fourth try.
 */
export const CAPTCHA_AFTER_FAILURES = 3;

/**
 * How long a failure keeps counting. Pushed forward by each new failure, so
 * the code stays required until the attempts actually stop, rather than
 * lapsing on a fixed schedule an attacker could simply wait out.
 */
export const LOGIN_FAILURE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Read a challenge field that may have been stringified into nonsense.
 *
 * next-auth's `signIn` builds its request body with `URLSearchParams`, which
 * renders a missing value as the literal string `"undefined"` instead of
 * dropping the key. Taken at face value that is a truthy code, so a sign-in
 * with no code field on screen was answered with "Invalid security code" —
 * for a code the person was never shown and had no way to supply.
 *
 * Normalising here rather than only at the call sites keeps the gate honest
 * whatever a client sends: what the browser omits and what it fills with
 * placeholder junk both have to mean "no code offered".
 */
export function readChallengeField(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;
  return trimmed;
}

/**
 * `x-forwarded-for` carries the whole proxy chain; the client is the first
 * entry. Returns null when there is nothing usable, which matters: an
 * "unknown" bucket would be shared by every visitor, so three failures
 * anywhere would put a code in front of the entire site.
 */
export function normaliseClientIp(value?: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0].trim().toLowerCase();
  if (!first || first === "unknown") return null;
  return first;
}

/**
 * The counters this attempt is measured against: the address being tried, and
 * the client trying it.
 *
 * Per-address alone is not enough — rotating the email resets the count on
 * every request, which is exactly what credential stuffing does. Per-client
 * alone is not enough either, since a botnet's addresses are all different.
 * Either counter reaching the threshold is enough to demand a code.
 */
export function loginFailureKeys(
  portal: LoginPortal,
  email: string,
  ip?: string | null
): string[] {
  const keys = [`loginfail:${portal}:${email.trim().toLowerCase()}`];
  const client = normaliseClientIp(ip);
  if (client) keys.push(`loginfail:${portal}:ip:${client}`);
  return keys;
}

/** True once any of the live counters has reached the threshold. */
export function captchaRequiredFor(counts: number[]): boolean {
  return counts.some((count) => count >= CAPTCHA_AFTER_FAILURES);
}
