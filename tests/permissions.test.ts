import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSIONS, isPermission } from "@/lib/permissions";

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("permission catalogue", () => {
  it("holds exactly 57 keys", () => {
    expect(ALL_PERMISSIONS).toHaveLength(57);
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

  it("has no dead keys — every permission is referenced in the source", () => {
    const src = path.resolve(__dirname, "../src");
    const corpus = sourceFiles(src)
      .filter((f) => !f.endsWith("permissions.ts"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");

    const unused = ALL_PERMISSIONS.filter((key) => !corpus.includes(`"${key}"`));
    expect(unused, `unreferenced permissions: ${unused.join(", ")}`).toEqual([]);
  });
});
