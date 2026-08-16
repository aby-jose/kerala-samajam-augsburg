import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ACTIONS_DIR = path.resolve(__dirname, "../src/lib");

/**
 * What this test does and does not catch.
 *
 * It does: find every `-actions.ts` file under src/lib (recursively), read
 * each exported action's own source text, and fail if none of GUARD_CALLS
 * appears in it and it isn't on the UNGUARDED_ACTIONS allowlist. That is
 * enough to catch the case it exists for — an action shipped with no call to
 * anything that looks like a permission check.
 *
 * It does not: parse or execute anything. It is a text search over each
 * action's own source slice, so it cannot tell a real guard call from:
 *   - a guard's name mentioned in a comment or a string/template literal;
 *   - a guard call sitting in a branch that never runs, or after a `return`;
 *   - a guard called only *after* a mutating side effect has already fired;
 *   - a guard reached through indirection this file hasn't been told about
 *     (see the comments on requireUserId/requireAiCaller below — those are
 *     verified by hand, not detected).
 * A green run means "every action's text contains a guard-shaped string in
 * the allowed positions," not "every action is provably safe." Treat it as
 * a floor, not a proof.
 */

/**
 * Actions that legitimately run without a guard. Every entry needs a reason —
 * this list is the only way an unguarded action reaches production, so it must
 * stay short enough to read.
 */
const UNGUARDED_ACTIONS: Record<string, string> = {
  // Public site rendering: the site cannot draw a page without its config.
  fetchConfigAction: "Public — site chrome depends on it",
  getAboutContent: "Public — About page content, same category as fetchConfigAction",
  getHomeContent: "Public — Home page content, same category as fetchConfigAction",
  // Sign-up and recovery, reachable by definition before a session exists.
  getNewCaptcha: "Public — issued before sign-in",
  getCaptcha: "Public — issued before registration",
  getContactCaptcha: "Public — issued before the contact form",
  registerUser: "Public — creates the account",
  verifyEmail: "Public — token is the credential",
  requestPasswordReset: "Public — rate-limited, reveals nothing",
  resetPassword: "Public — token is the credential",
  resendVerification: "Public — rate-limited, constant reply, cannot enumerate",
  submitContactForm: "Public — captcha-gated",
  unsubscribeByToken: "Public — token is the credential",
  resubscribeByToken: "Public — token is the credential",
  // Public read paths.
  getUpcomingEvents: "Public — published events only",
  getEventBySlug: "Public — published events only",
  getGalleryHighlights: "Public — published albums only",
  getActiveMembershipPlans: "Public — pricing page",
  getPublishedLegalSlugs: "Public — footer links",
  getLeadershipMembers: "Public — board bios on the home and about pages",
  getCookieConsent: "Public — anonymous visitors",
  saveCookieConsent: "Public — anonymous visitors",
  withdrawCookieConsent: "Public — anonymous visitors",
};

const GUARD_CALLS = [
  "requirePermission(",
  "requirePermissionPage(",
  "requireStaff(",
  "requireUser(",
  "requireAnyUser(",
  "getServerSession(",
  "getCurrentUser(",
  // Still in use by upload-actions.ts until Task 8 converts it.
  "getAdminUser(",
  // The direct admin guard. Every current admin action calls this one —
  // its absence here was a detection gap, not a coverage gap: it showed up
  // as 62 actions across 12 files failing this test on a codebase where
  // every one of them opens with `await requireAdmin();`.
  "requireAdmin(",
  // Local wrapper in privacy-actions.ts, `async function requireUserId() {
  // return (await requireUser()).id; }`. Six GDPR self-service actions call
  // this instead of requireUser() directly; same guard, one line of
  // indirection this text scan can't see through on its own.
  "requireUserId(",
  // Local wrapper in event-actions.ts around the AI-assist helpers
  // (generateEventImage, generateEventDetails, improveEventTitle,
  // improveEventDescription, generateCategory). It calls requireAdmin() and
  // then applies a per-administrator rate limit before any Gemini/image call
  // runs — a guard plus a budget, not a bypass.
  "requireAiCaller(",
];

/**
 * `-actions.ts` is a naming convention, not a guarantee that a file is a
 * server-action module. `ticket-actions.ts` and `invoice-actions.ts`
 * deliberately open without the `"use server"` directive (see the comment at
 * the top of each) specifically so their exports do NOT become server
 * actions the browser can invoke — they are plain functions, reachable only
 * by direct import from other, already-guarded actions running on the
 * server. Without the directive there is no public surface for this test to
 * check, so a file that lacks it is skipped entirely rather than allowlisted
 * function-by-function.
 *
 * Accepts either quote style. Next.js itself doesn't care which one a file
 * uses for the directive, so neither should this check — a single-quoted
 * `'use server'` file must not be silently skipped as a false negative.
 */
function isServerActionModule(source: string): boolean {
  const first = source.trimStart();
  return first.startsWith('"use server"') || first.startsWith("'use server'");
}

/** Every `-actions.ts` file under src/lib, however deep it's nested. */
function actionFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...actionFiles(full));
    } else if (entry.isFile() && entry.name.endsWith("-actions.ts")) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Every exported action, whichever of the two shapes actually used in this
 * codebase it's written in:
 *
 *   export async function name(...) { ... }
 *   export const name = async (...) => { ... }
 *   export const name = cache(async (...) => { ... })   // or nested further
 *
 * All server actions are necessarily async — Next.js requires it for any
 * export of a `"use server"` file — so matching on the `async` keyword after
 * the export, through any number of wrapping calls, covers both shapes with
 * one alternation.
 *
 * This finds the start of every export and slices from there to the start
 * of the next one (or EOF). That is deliberate, not incidental: an old
 * version of this function split the file on the *function-declaration*
 * marker alone, so an arrow-style export sitting between two declaration
 * exports would vanish into whichever declaration text ran into it —
 * invisible itself, and silently borrowing that neighbour's guard call in
 * the substring check. Anchoring on the true start of *every* export style
 * and slicing between consecutive starts keeps each action's text isolated
 * to only its own source, regardless of which shape it or its neighbours use.
 */
function extractActions(source: string): { name: string; body: string }[] {
  const EXPORT_START =
    /^export (?:async function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:\w+\(\s*)*async\b)/gm;

  const starts: { name: string; index: number }[] = [];
  for (const m of source.matchAll(EXPORT_START)) {
    starts.push({ name: (m[1] ?? m[2])!, index: m.index });
  }

  return starts.map((start, i) => ({
    name: start.name,
    body: source.slice(start.index, starts[i + 1]?.index ?? source.length),
  }));
}

describe("action coverage", () => {
  const files = actionFiles(ACTIONS_DIR);

  it("finds the action files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const label = path.relative(ACTIONS_DIR, file).split(path.sep).join("/");
    if (!isServerActionModule(source)) continue;
    for (const action of extractActions(source)) {
      const exempt = action.name in UNGUARDED_ACTIONS;
      it(`${label} → ${action.name} is guarded${exempt ? " (exempt)" : ""}`, () => {
        if (exempt) return;
        const guarded = GUARD_CALLS.some((call) => action.body.includes(call));
        expect(
          guarded,
          `${action.name} in ${label} calls no guard. Add one, or add it to ` +
            `UNGUARDED_ACTIONS in this file with a reason.`
        ).toBe(true);
      });
    }
  }
});
