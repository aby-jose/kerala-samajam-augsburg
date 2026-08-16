import { describe, expect, it } from "vitest";
import {
  LockoutError,
  assertAssignable,
  assertRoleDeletable,
  assertRoleEditable,
} from "@/lib/rbac/lockout";

describe("assertRoleEditable", () => {
  it("allows editing an ordinary role", () => {
    expect(() => assertRoleEditable({ isSystem: false })).not.toThrow();
  });

  it("refuses to edit the system role", () => {
    expect(() => assertRoleEditable({ isSystem: true })).toThrow(LockoutError);
  });
});

describe("assertRoleDeletable", () => {
  it("allows deleting an unused ordinary role", () => {
    expect(() => assertRoleDeletable({ isSystem: false, userCount: 0 })).not.toThrow();
  });

  it("refuses to delete the system role", () => {
    expect(() => assertRoleDeletable({ isSystem: true, userCount: 0 })).toThrow(LockoutError);
  });

  it("refuses to delete a role that still has holders", () => {
    expect(() => assertRoleDeletable({ isSystem: false, userCount: 3 })).toThrow(
      /3 (staff member|people)/
    );
  });
});

describe("assertAssignable", () => {
  const base = {
    actorId: "actor-1",
    targetId: "target-1",
    targetIsSuperAdmin: false,
    remainingSuperAdmins: 2,
  };

  it("allows an ordinary change", () => {
    expect(() => assertAssignable(base)).not.toThrow();
  });

  it("refuses to let someone change their own role", () => {
    expect(() => assertAssignable({ ...base, targetId: "actor-1" })).toThrow(
      /your own/i
    );
  });

  it("refuses to demote the last super admin", () => {
    expect(() =>
      assertAssignable({ ...base, targetIsSuperAdmin: true, remainingSuperAdmins: 1 })
    ).toThrow(/last/i);
  });

  it("allows demoting a super admin while another remains", () => {
    expect(() =>
      assertAssignable({ ...base, targetIsSuperAdmin: true, remainingSuperAdmins: 2 })
    ).not.toThrow();
  });
});
