/**
 * Where to send someone once a token-based auth flow (email verification,
 * password reset) resolves successfully — an administrator lands back on the
 * admin login rather than the public one. `verify-email/page.tsx` makes the
 * same choice inline; this is the same rule for `reset-password/page.tsx`.
 */
export function postAuthRedirect(role: string | undefined): string {
  return role === "ADMIN" ? "/admin/login" : "/?auth=login";
}
