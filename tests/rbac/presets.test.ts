import { describe, expect, it } from "vitest";
import { ROLE_PRESETS } from "@/lib/rbac/presets";
import { ALL_PERMISSIONS, PERMISSIONS, isPermission } from "@/lib/permissions";

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
    const reads = ALL_PERMISSIONS.filter((k) => !PERMISSIONS[k].mutates);
    expect([...viewer.permissions].sort()).toEqual([...reads].sort());
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
