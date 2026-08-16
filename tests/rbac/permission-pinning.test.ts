import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * Pins the literal permission key a meaningful sample of actions guard with.
 *
 * Every test elsewhere that touches `requirePermission` mocks it away
 * wholesale (`vi.mock("@/lib/guards", () => ({ requirePermission: vi.fn() }))`),
 * and `tests/action-coverage.test.ts` only checks that *some* guard-shaped
 * substring is present in an action's body — never *which* key. Swapping
 * `payments.revert` for `payments.view` at a call site would pass every one
 * of those 254+ tests.
 *
 * This reads source directly instead of mocking anything: find the named
 * export, slice to the start of the next top-level export (or EOF), and read
 * the literal string argument of that action's own `requirePermission(...)`
 * call. A destructive or money-touching action quietly repointed at the
 * wrong permission fails here even though every mocked unit test around it
 * stays green.
 *
 * Same caveat as `action-coverage.test.ts`: this is a text slice, not a
 * parse. It is enough to pin the specific keys below; it is not a general
 * verifier for every action in the codebase.
 */

const LIB_DIR = path.resolve(__dirname, "../../src/lib");

const EXPORT_START =
  /^export (?:async function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:\w+\(\s*)*async\b)/gm;

/** Slice out one named top-level export's own source, up to the next export. */
function actionBody(file: string, name: string): string {
  const source = readFileSync(path.join(LIB_DIR, file), "utf8");
  const starts: { name: string; index: number }[] = [];
  for (const m of source.matchAll(EXPORT_START)) {
    starts.push({ name: (m[1] ?? m[2])!, index: m.index });
  }
  const i = starts.findIndex((s) => s.name === name);
  if (i === -1) {
    throw new Error(`${name} is not a top-level export in src/lib/${file} — did it move or get renamed?`);
  }
  return source.slice(starts[i].index, starts[i + 1]?.index ?? source.length);
}

/** The literal key this action's own `requirePermission("…")` call names, or null. */
function permissionOf(body: string): string | null {
  const m = body.match(/requirePermission\(\s*["'`]([a-zA-Z0-9_.]+)["'`]\s*\)/);
  return m ? m[1] : null;
}

/**
 * At minimum, every destructive or money-touching action named in the final
 * review pass. Add to this list rather than trusting the coverage test's
 * substring check alone for anything that deletes, reverses money, or grants
 * access.
 */
const EXPECTED: { file: string; action: string; permission: string }[] = [
  { file: "event-actions.ts", action: "deleteEvent", permission: "events.delete" },
  { file: "event-actions.ts", action: "deleteRegistration", permission: "registrations.delete" },
  { file: "payment-actions.ts", action: "recordRegistrationPayment", permission: "payments.record" },
  { file: "membership-actions.ts", action: "recordSubscriptionPayment", permission: "payments.record" },
  { file: "payment-actions.ts", action: "revertRegistrationPayment", permission: "payments.revert" },
  { file: "membership-actions.ts", action: "revertSubscriptionPayment", permission: "payments.revert" },
  { file: "membership-actions.ts", action: "suspendUser", permission: "members.suspend" },
  { file: "privacy-actions.ts", action: "completeAccountDeletion", permission: "members.erase" },
  { file: "gallery-actions.ts", action: "deleteAlbum", permission: "gallery.albums.delete" },
  { file: "gallery-actions.ts", action: "bulkDeleteMedia", permission: "gallery.media.delete" },
  { file: "contact-actions.ts", action: "deleteMessage", permission: "inquiries.delete" },
  { file: "legal-actions.ts", action: "adminPublishVersion", permission: "legal.publish" },
  { file: "legal-actions.ts", action: "adminSetPublished", permission: "legal.publish" },
  { file: "staff-actions.ts", action: "changeStaffRole", permission: "staff.manage" },
  { file: "staff-actions.ts", action: "revokeStaffAccess", permission: "staff.manage" },
  { file: "role-actions.ts", action: "upsertRole", permission: "roles.edit" },
  { file: "role-actions.ts", action: "deleteRole", permission: "roles.edit" },
];

describe("action -> permission key pinning (Important 5)", () => {
  for (const { file, action, permission } of EXPECTED) {
    it(`${file} -> ${action}() guards with requirePermission("${permission}")`, () => {
      const body = actionBody(file, action);
      expect(permissionOf(body)).toBe(permission);
    });
  }
});
