import { describe, expect, it } from "vitest";
import { ROLE_PRESETS } from "@/lib/rbac/presets";
import { isPermission } from "@/lib/permissions";

/**
 * Every non-mutating key in the catalogue, written out by hand rather than
 * re-derived with `ALL_PERMISSIONS.filter((k) => !PERMISSIONS[k].mutates)`.
 *
 * `presets.ts` builds Viewer's permission list with exactly that filter, so
 * asserting the preset against the same expression only proves the
 * expression equals itself — it cannot fail no matter what any individual
 * key's `mutates` flag says. A permission wrongly marked `mutates: false`
 * would both skip the audit floor `requirePermission()` builds on that flag
 * *and* silently widen what Viewer can see, and this recomputation would
 * still pass. An explicit, independently-typed list catches both: add or
 * remove a `.view`-style key, or flip a `mutates` flag, and this test moves
 * out of step with `presets.ts` until someone updates it deliberately.
 */
const EXPECTED_READ_ONLY = [
  "analytics.view",
  "audit.view",
  "dashboard.view",
  "email.view",
  "events.view",
  "gallery.contributions.view",
  "gallery.view",
  "inquiries.notify",
  "inquiries.view",
  "legal.consents.view",
  "legal.view",
  "members.view",
  "membership.applications.view",
  "membership.plans.view",
  "payments.view",
  "reels.view",
  "registrations.view",
  "roles.view",
  "staff.view",
].sort();

describe("role presets", () => {
  it("ships six roles with unique names", () => {
    expect(ROLE_PRESETS).toHaveLength(6);
    expect(new Set(ROLE_PRESETS.map((r) => r.name)).size).toBe(6);
  });

  it("marks exactly one as the system role", () => {
    const system = ROLE_PRESETS.filter((r) => r.isSystem);
    expect(system).toHaveLength(1);
    expect(system[0].name).toBe("Super Admin");
  });

  it("references only catalogued permissions", () => {
    for (const preset of ROLE_PRESETS) {
      for (const key of preset.permissions) {
        expect(isPermission(key), `${preset.name} → ${key}`).toBe(true);
      }
    }
  });

  it("gives Viewer every read permission and nothing that mutates", () => {
    const viewer = ROLE_PRESETS.find((r) => r.name === "Viewer")!;
    expect([...viewer.permissions].sort()).toEqual(EXPECTED_READ_ONLY);
  });

  it("lets Gallery Moderator moderate but not touch money", () => {
    const mod = ROLE_PRESETS.find((r) => r.name === "Gallery Moderator")!;
    expect(mod.permissions).toContain("gallery.contributions.moderate");
    expect(mod.permissions.some((p) => p.startsWith("payments."))).toBe(false);
    expect(mod.permissions.some((p) => p.startsWith("members."))).toBe(false);
  });

  it("leaves Super Admin's array empty — its set is computed, not stored", () => {
    const su = ROLE_PRESETS.find((r) => r.name === "Super Admin")!;
    expect(su.permissions).toEqual([]);
  });
});
