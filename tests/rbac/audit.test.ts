import { describe, expect, it } from "vitest";
import { auditSummaryFor } from "@/lib/rbac/audit";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";

describe("auditSummaryFor", () => {
  it("falls back to the catalogue label", () => {
    expect(auditSummaryFor("payments.record")).toBe(PERMISSIONS["payments.record"].label);
  });

  it("produces a non-empty summary for every mutating permission", () => {
    for (const key of ALL_PERMISSIONS) {
      if (!PERMISSIONS[key].mutates) continue;
      expect(auditSummaryFor(key), `${key} summary`).toBeTruthy();
    }
  });
});
