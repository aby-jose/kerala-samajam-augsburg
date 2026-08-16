import { describe, expect, it } from "vitest";
import { resolvePermissions } from "@/lib/rbac/resolve";
import { ALL_PERMISSIONS } from "@/lib/permissions";

describe("resolvePermissions", () => {
  it("returns the stored keys for an ordinary role", () => {
    const set = resolvePermissions({
      isSystem: false,
      permissions: ["payments.view", "payments.record"],
    });
    expect(set.has("payments.view")).toBe(true);
    expect(set.has("payments.revert")).toBe(false);
    expect(set.size).toBe(2);
  });

  it("gives a system role the whole catalogue regardless of its array", () => {
    const set = resolvePermissions({ isSystem: true, permissions: [] });
    expect(set.size).toBe(ALL_PERMISSIONS.length);
    for (const key of ALL_PERMISSIONS) expect(set.has(key)).toBe(true);
  });

  it("drops stored keys that are no longer in the catalogue", () => {
    const set = resolvePermissions({
      isSystem: false,
      permissions: ["payments.view", "stripe.refund"],
    });
    expect(set.has("payments.view")).toBe(true);
    expect(set.size).toBe(1);
  });

  it("treats a missing role as no permissions at all", () => {
    expect(resolvePermissions(null).size).toBe(0);
  });
});
