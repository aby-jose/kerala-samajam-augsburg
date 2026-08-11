/**
 * Where committee notifications go.
 *
 * This was previously inlined as `process.env.ADMIN_EMAIL || "<someone's
 * personal gmail>"` at five call sites, with three different fallbacks. If the
 * variable were ever missing in production, member enquiries and contribution
 * notices would have gone to a private inbox without anyone noticing — and
 * `getAllMembers` uses the same address to decide which account to hide, so a
 * wrong value silently hid the wrong person.
 *
 * There is no fallback now. A missing address is a deployment fault and should
 * read as one.
 */
export function adminEmail(): string {
  const configured = process.env.ADMIN_EMAIL?.trim();

  if (!configured) {
    throw new Error(
      "ADMIN_EMAIL is not set. Committee notifications have nowhere to go — " +
        "set it in the environment before starting the app."
    );
  }

  return configured;
}

/**
 * Non-throwing variant, for paths where a missing address should not take the
 * whole operation down — hiding a row from a list, say. Logs instead.
 */
export function adminEmailOrNull(): string | null {
  const configured = process.env.ADMIN_EMAIL?.trim();
  if (!configured) {
    console.error("ADMIN_EMAIL is not set — falling back to no admin address.");
    return null;
  }
  return configured;
}
