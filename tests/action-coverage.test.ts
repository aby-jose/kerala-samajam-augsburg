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
  getPageContent: "Public — page content, same category as getAboutContent",
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
  getInviteForToken: "Public — the invite token is the credential",
  acceptInvite: "Public — the invite token is the credential",
};

const GUARD_CALLS = [
  "requirePermission(",
  "requirePermissionPage(",
  "requireStaff(",
  "requireUser(",
  "requireAnyUser(",
  "getServerSession(",
  "getCurrentUser(",
  // Local wrapper in privacy-actions.ts, `async function requireUserId() {
  // return (await requireUser()).id; }`. Six GDPR self-service actions call
  // this instead of requireUser() directly; same guard, one line of
  // indirection this text scan can't see through on its own.
  "requireUserId(",
  // Local wrapper in event-actions.ts around the AI-assist helpers
  // (generateEventImage, generateEventDetails, improveEventTitle,
  // improveEventDescription, generateCategory). It calls
  // requirePermission("events.ai") and then applies a per-administrator rate
  // limit before any Gemini/image call runs — a guard plus a budget, not a
  // bypass.
  "requireAiCaller(",
];

/**
 * `getAdminUser(` and `requireAdmin(` used to live in this list. Both are
 * gone on purpose, not by omission:
 *
 *  - `requireAdmin()` no longer exists in the codebase (removed once every
 *    call site was converted to `requirePermission()`); its presence here
 *    was satisfied by a stray comment mentioning the name, not a real call.
 *  - `getAdminUser()` reads `role` from the JWT rather than the database —
 *    exactly the shortcut `requirePermission()` exists to close (see D3 in
 *    the design doc). Nothing in `src/lib/*-actions.ts` calls it directly
 *    (verified by search); it remains legitimate internal plumbing inside
 *    `guards.ts` itself and in `feature-gate.ts`'s `assertFeature`, neither
 *    of which this test scans as an action.
 *
 * If a future action is found to need `getAdminUser()` directly, that is
 * itself the bug to fix (convert it to `requirePermission()`), not a reason
 * to put the string back here.
 */

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

/**
 * Every `-actions.ts` file under src/lib, however deep it's nested. Also
 * matches a bare `actions.ts` — the convention a subdirectory module uses
 * (e.g. `page-content/actions.ts`) once its own directory name already gives
 * the prefix the flat `<name>-actions.ts` files spell out in the filename.
 */
function actionFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...actionFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith("-actions.ts") || entry.name === "actions.ts")) {
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

/**
 * Route handlers (`src/app/api/**\/route.ts`) are a second, separate public
 * surface — reachable directly by URL, entirely outside `proxy.ts`'s
 * `/admin/:path*` match and outside this file's own `-actions.ts` glob. That
 * gap is exactly how `POST /api/config` shipped guarded only by
 * `getAdminUser()` (JWT-trusting, no permission check) and sat undetected
 * until a whole-branch review found it by hand. This block exists so that
 * category can never be invisible again.
 *
 * Every exported HTTP method in every route file must either call one of
 * `GUARD_CALLS` above, or appear on `UNGUARDED_ROUTES` below with a reason —
 * same discipline as the action scan, applied to a different export shape.
 */
const ROUTES_DIR = path.resolve(__dirname, "../src/app/api");

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * Routes that legitimately answer with no call to anything in GUARD_CALLS.
 * Every entry needs a reason, checked by hand — a route handler's
 * authorisation is often a shared secret or a per-resource scope rather than
 * a session guard, neither of which a text scan can verify on its own.
 */
const UNGUARDED_ROUTES: Record<string, string> = {
  "admin/auth/[...nextauth]/route.ts#GET":
    "Framework route — NextAuth's own handler. Must stay unauthenticated so sign-in itself is reachable.",
  "admin/auth/[...nextauth]/route.ts#POST":
    "Framework route — NextAuth's own handler. Must stay unauthenticated so sign-in itself is reachable.",
  "auth/[...nextauth]/route.ts#GET":
    "Framework route — NextAuth's own handler. Must stay unauthenticated so sign-in itself is reachable.",
  "auth/[...nextauth]/route.ts#POST":
    "Framework route — NextAuth's own handler. Must stay unauthenticated so sign-in itself is reachable.",
  "cron/route.ts#GET":
    "Bearer CRON_SECRET checked in authorise() — refuses when the secret is unset or the caller's value " +
    "doesn't match. Not a session guard, so it can't be text-matched; verified by hand.",
  "cron/route.ts#POST":
    "Same authorise() check as GET — some schedulers only issue POST.",
  "gallery/download/route.ts#GET":
    "Public by design — the publicId is resolved against GalleryMedia scoped to a *published* album before " +
    "anything is fetched, so nothing outside the public gallery is addressable through it.",
  "tickets/[ticketId]/route.ts#GET":
    "Public by design — the ticket id (a CSPRNG value) is the credential, the same way a payment receipt " +
    "link is; misses are rate-limited per client to blunt enumeration.",
};

/** Every `route.ts` file under src/app/api, however deep it's nested. */
function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...routeFiles(full));
    } else if (entry.isFile() && entry.name === "route.ts") {
      found.push(full);
    }
  }
  return found;
}

/**
 * Every exported HTTP method, in whichever of the two shapes Next.js route
 * handlers actually use in this codebase:
 *
 *   export async function GET(...) { ... }
 *   export { handler as GET, handler as POST };
 *
 * A direct declaration's body is sliced the same way `extractActions` slices
 * an action — from its own export to the start of the next one, or EOF — so
 * a guard call in a neighbouring handler is never mistaken for this one's.
 * A re-export has no body of its own to slice, so the whole file is used as
 * its text: harmless for the routes this repo has today (none resolve to a
 * guard call that way and all sit on the allowlist instead), and it means a
 * future route that both re-exports *and* calls a guard nearby is still
 * detected rather than automatically failing.
 */
function extractRouteMethods(source: string): { method: HttpMethod; body: string }[] {
  const DIRECT_START = /^export (?:async function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(|const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*(?:\w+\(\s*)*async\b)/gm;

  const starts: { method: HttpMethod; index: number }[] = [];
  for (const m of source.matchAll(DIRECT_START)) {
    starts.push({ method: (m[1] ?? m[2]) as HttpMethod, index: m.index });
  }

  const results: { method: HttpMethod; body: string }[] = starts.map((start, i) => ({
    method: start.method,
    body: source.slice(start.index, starts[i + 1]?.index ?? source.length),
  }));

  const seen = new Set(results.map((r) => r.method));

  // `export { handler as GET, handler as POST };` — one statement can name
  // several methods at once.
  const REEXPORT = /^export\s*\{([^}]+)\}\s*;?/gm;
  for (const m of source.matchAll(REEXPORT)) {
    for (const clause of m[1].split(",")) {
      const named = clause.match(/\bas\s+(GET|POST|PUT|PATCH|DELETE)\b/);
      if (named && !seen.has(named[1] as HttpMethod)) {
        seen.add(named[1] as HttpMethod);
        results.push({ method: named[1] as HttpMethod, body: source });
      }
    }
  }

  return results;
}

describe("route handler coverage", () => {
  const files = routeFiles(ROUTES_DIR);

  it("finds the route files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const label = path.relative(ROUTES_DIR, file).split(path.sep).join("/");
    for (const { method, body } of extractRouteMethods(source)) {
      const key = `${label}#${method}`;
      const exempt = key in UNGUARDED_ROUTES;
      it(`${label} → ${method} is guarded${exempt ? " (exempt)" : ""}`, () => {
        if (exempt) return;
        const guarded = GUARD_CALLS.some((call) => body.includes(call));
        expect(
          guarded,
          `${method} in ${label} calls no guard. Add one, or add "${key}" to ` +
            `UNGUARDED_ROUTES in this file with a reason.`
        ).toBe(true);
      });
    }
  }
});
