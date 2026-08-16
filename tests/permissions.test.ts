import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSIONS, isPermission } from "@/lib/permissions";

describe("permission catalogue", () => {
  it("holds exactly 55 keys", () => {
    expect(ALL_PERMISSIONS).toHaveLength(55);
  });

  it("gives every key a group, a label and a mutates flag", () => {
    for (const key of ALL_PERMISSIONS) {
      const entry = PERMISSIONS[key];
      expect(entry.group, `${key} group`).toBeTruthy();
      expect(entry.label, `${key} label`).toBeTruthy();
      expect(typeof entry.mutates, `${key} mutates`).toBe("boolean");
    }
  });

  it("uses resource.verb form throughout", () => {
    for (const key of ALL_PERMISSIONS) {
      expect(key, `${key} shape`).toMatch(/^[a-z]+(\.[a-z]+){1,2}$/);
    }
  });

  it("never marks a .view key as mutating", () => {
    for (const key of ALL_PERMISSIONS) {
      if (key.endsWith(".view")) {
        expect(PERMISSIONS[key].mutates, `${key} should not mutate`).toBe(false);
      }
    }
  });

  it("narrows known keys and rejects unknown ones", () => {
    expect(isPermission("payments.record")).toBe(true);
    expect(isPermission("payments.embezzle")).toBe(false);
  });
});
