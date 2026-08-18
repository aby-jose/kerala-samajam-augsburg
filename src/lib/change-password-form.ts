/**
 * Client-side check for the admin "change password" form.
 *
 * A shallow pre-check only — the server re-validates every rule with
 * `passwordSchema` in `account-actions.ts` and is what actually decides. This
 * exists so a mismatched confirmation or an obviously-too-short password
 * doesn't cost a round trip. Kept in sync with `PASSWORD_MIN_LENGTH` in
 * `password-rules.ts` by hand, same as `reset-password/page.tsx` already does.
 */
const PASSWORD_MIN_LENGTH = 12;

export function validateChangePasswordForm(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): string | null {
  if (!input.currentPassword) return "Enter your current password.";
  if (input.newPassword.length < PASSWORD_MIN_LENGTH) {
    return `New password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (input.newPassword !== input.confirmPassword) return "New passwords do not match.";
  return null;
}
