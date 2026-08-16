import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ACTIONS_DIR = path.resolve(__dirname, "../src/lib");

/**
 * Actions that legitimately run without a guard. Every entry needs a reason —
 * this list is the only way an unguarded action reaches production, so it must
 * stay short enough to read.
 */
const UNGUARDED_ACTIONS: Record<string, string> = {
  // Public site rendering: the site cannot draw a page without its config.
  fetchConfigAction: "Public — site chrome depends on it",
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
 */
function isServerActionModule(source: string): boolean {
  return source.trimStart().startsWith('"use server"');
}

function actionFiles(): string[] {
  return readdirSync(ACTIONS_DIR).filter((f) => f.endsWith("-actions.ts"));
}

/** Crude but sufficient: split the file at each exported async function. */
function extractActions(source: string): { name: string; body: string }[] {
  const parts = source.split(/^export async function /m).slice(1);
  return parts.map((part) => ({
    name: part.slice(0, part.indexOf("(")).trim(),
    body: part,
  }));
}

describe("action coverage", () => {
  const files = actionFiles();

  it("finds the action files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const source = readFileSync(path.join(ACTIONS_DIR, file), "utf8");
    if (!isServerActionModule(source)) continue;
    for (const action of extractActions(source)) {
      const exempt = action.name in UNGUARDED_ACTIONS;
      it(`${file} → ${action.name} is guarded${exempt ? " (exempt)" : ""}`, () => {
        if (exempt) return;
        const guarded = GUARD_CALLS.some((call) => action.body.includes(call));
        expect(
          guarded,
          `${action.name} in ${file} calls no guard. Add one, or add it to ` +
            `UNGUARDED_ACTIONS in this file with a reason.`
        ).toBe(true);
      });
    }
  }
});
