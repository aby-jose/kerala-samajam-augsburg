/**
 * Who is allowed through the sign-in door, and why they were turned away.
 *
 * Deliberately free of imports. The login modal and the admin login page are
 * both client components and need `EMAIL_NOT_VERIFIED` to recognise the
 * failure and offer a way out of it; pulling that constant from `auth.ts`
 * would drag prisma and bcrypt into the browser bundle.
 */

/**
 * Sentinel, not prose.
 *
 * next-auth surfaces whatever an `authorize` throws as `result.error`, a bare
 * string with no structure. A human-readable sentence there would have to be
 * string-matched by the UI to know when to offer a resend, and would then
 * break the moment the wording changed. The UI matches this code and supplies
 * its own copy.
 */
export const EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";

/** Shown as-is: the member needs to know to contact the committee. */
export const SUSPENDED_ERROR =
  "Your account has been suspended. Please contact the administrator.";

export interface SignInGateUser {
  role: string;
  emailVerified: Date | null;
}

/**
 * The reason this account may not sign in, or `null` if it may.
 *
 * Suspension is checked first on purpose. A suspended account that also has an
 * unverified address would otherwise be sent round the verification loop —
 * email, click, sign in — only to be refused at the end of it for a reason
 * nobody had mentioned.
 *
 * Both checks assume the password has *already* been verified by the caller.
 * Running them earlier would leak whether an address has an account to anyone
 * who can type one into the form.
 */
export function signInBlockReason(user: SignInGateUser): string | null {
  if (user.role.startsWith("SUSPENDED_")) return SUSPENDED_ERROR;
  if (!user.emailVerified) return EMAIL_NOT_VERIFIED;
  return null;
}
