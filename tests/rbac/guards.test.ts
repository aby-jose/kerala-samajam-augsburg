import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -----------------------------------------------------------------
//
// See task-5b-brief.md for the rationale behind each of these.

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (fn: unknown) => fn,
}));

vi.mock("@/lib/auth", () => ({ adminAuthOptions: {}, publicAuthOptions: {} }));

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/rbac/audit", () => ({
  recordAudit: vi.fn(),
  describeAudit: vi.fn(),
  auditSummaryFor: (k: string) => k,
}));

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/rbac/audit";
import { can, requirePermission, requirePermissionPage } from "@/lib/guards";

const mockedGetServerSession = vi.mocked(getServerSession);
const mockedRedirect = vi.mocked(redirect);
const mockedFindUnique = vi.mocked(prisma.user.findUnique);
const mockedRecordAudit = vi.mocked(recordAudit);

type StaffRoleRow = { name: string; permissions: string[]; isSystem: boolean } | null;

/**
 * Sets up "signed in as X with role Y" in one line.
 *
 * - Omitting `sessionRole` means no session at all (the admin cookie is
 *   absent) — `getServerSession` resolves to `null`.
 * - `dbRole: null` means the row lookup itself comes back empty — a deleted
 *   user, checked against a still-valid session.
 * - `dbRole` otherwise stocks `prisma.user.findUnique` with a row shaped
 *   exactly as `getStaffContext`'s `select` requests it.
 */
function signedInAs(opts: {
  sessionRole?: string;
  dbRole?: string | null;
  staffRole?: StaffRoleRow;
}) {
  const { sessionRole, dbRole, staffRole = null } = opts;

  if (sessionRole === undefined) {
    mockedGetServerSession.mockResolvedValue(null);
  } else {
    mockedGetServerSession.mockResolvedValue({
      user: { id: "user-1", email: "staff@example.org", name: "Staff Member", role: sessionRole },
    } as never);
  }

  if (dbRole === null) {
    mockedFindUnique.mockResolvedValue(null as never);
  } else if (dbRole !== undefined) {
    mockedFindUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.org",
      name: "Staff Member",
      role: dbRole,
      staffRole,
    } as never);
  }
}

const ORDINARY_ROLE: StaffRoleRow = {
  name: "Payments Clerk",
  permissions: ["payments.view", "payments.record"],
  isSystem: false,
};

const SUPER_ADMIN_ROLE: StaffRoleRow = {
  name: "Super Admin",
  permissions: [],
  isSystem: true,
};

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) so a mockResolvedValue from one test
  // cannot silently persist into the next one — every test must stock the
  // database stub it actually needs, not inherit a prior test's answer.
  vi.resetAllMocks();
  // resetAllMocks wipes the throwing implementation set in the vi.mock
  // factory above (it counts as this mock's "initial implementation"), so
  // it has to be re-established here.
  mockedRedirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

describe("requirePermission", () => {
  it("resolves for a permission the role holds", async () => {
    signedInAs({ sessionRole: "ADMIN", dbRole: "ADMIN", staffRole: ORDINARY_ROLE });

    const ctx = await requirePermission("payments.record");

    expect(ctx.roleName).toBe("Payments Clerk");
  });

  it("throws Unauthorized for a permission the role does not hold", async () => {
    signedInAs({ sessionRole: "ADMIN", dbRole: "ADMIN", staffRole: ORDINARY_ROLE });

    await expect(requirePermission("payments.revert")).rejects.toThrow("Unauthorized");
  });

  it("gives Super Admin a permission absent from its stored array", async () => {
    signedInAs({ sessionRole: "ADMIN", dbRole: "ADMIN", staffRole: SUPER_ADMIN_ROLE });

    const ctx = await requirePermission("legal.consents.export");

    expect(ctx.roleName).toBe("Super Admin");
  });

  it("denies immediately when the role was revoked in the database", async () => {
    // The session's token still claims ADMIN — five minutes old, unrefreshed —
    // but the database row, read fresh on every call, says otherwise. This is
    // the whole reason getStaffContext queries the database instead of trusting
    // the token: a revoked administrator must not coast on a stale signature.
    //
    // staffRole is deliberately a real, non-null role here (not null, unlike
    // case 5 below). getStaffContext's guard is one compound condition —
    // `!row || row.role !== "ADMIN" || !row.staffRole` — and if staffRole
    // were also null, a regression that checked the session's role instead of
    // the database row would still be caught by the third disjunct, and this
    // test would pass for the wrong reason. With a real staffRole, the
    // database-role check is the ONLY disjunct that can fire, so this test
    // can only pass if that specific check is doing its job.
    signedInAs({ sessionRole: "ADMIN", dbRole: "MEMBER", staffRole: ORDINARY_ROLE });

    await expect(requirePermission("payments.view")).rejects.toThrow("Unauthorized");
  });

  it("fails closed for an administrator with no staff role assigned", async () => {
    // The state of every admin row before the RBAC seed backfills staffRole.
    signedInAs({ sessionRole: "ADMIN", dbRole: "ADMIN", staffRole: null });

    await expect(requirePermission("dashboard.view")).rejects.toThrow("Unauthorized");
    expect(await can("dashboard.view")).toBe(false);
  });

  it("fails closed when the user row has been deleted", async () => {
    // Session says signed in; the lookup for that id comes back empty.
    signedInAs({ sessionRole: "ADMIN", dbRole: null });

    await expect(requirePermission("dashboard.view")).rejects.toThrow("Unauthorized");
  });
});

describe("can", () => {
  it("returns false rather than throwing, and true for a held permission", async () => {
    signedInAs({ sessionRole: "ADMIN", dbRole: "ADMIN", staffRole: ORDINARY_ROLE });

    await expect(can("payments.revert")).resolves.toBe(false);
    await expect(can("payments.view")).resolves.toBe(true);
  });
});

describe("requirePermissionPage", () => {
  it("redirects to the two distinct destinations", async () => {
    // No context at all — the admin cookie itself is absent.
    signedInAs({});
    await expect(requirePermissionPage("dashboard.view")).rejects.toThrow(
      "REDIRECT:/admin/login"
    );

    // Signed in, but the held role lacks this permission.
    signedInAs({ sessionRole: "ADMIN", dbRole: "ADMIN", staffRole: ORDINARY_ROLE });
    await expect(requirePermissionPage("payments.revert")).rejects.toThrow(
      "REDIRECT:/admin/no-access"
    );
  });

  it("never redirects a denial to a page that is itself permission-guarded", async () => {
    // Regression guard for the loop this fixed: /admin/dashboard requires
    // dashboard.view, so a role denied *that* permission and sent back to
    // /admin/dashboard would be denied again, forever. A role missing
    // dashboard.view — exactly the state the seeded Content Editor and
    // Gallery Moderator presets were in — must land somewhere that does not
    // itself check a permission.
    signedInAs({
      sessionRole: "ADMIN",
      dbRole: "ADMIN",
      staffRole: { name: "Content Editor", permissions: ["content.about.edit"], isSystem: false },
    });

    await expect(requirePermissionPage("dashboard.view")).rejects.toThrow(
      "REDIRECT:/admin/no-access"
    );
  });
});

describe("audit trail", () => {
  it("fires only for permissions whose mutates flag is set", async () => {
    signedInAs({ sessionRole: "ADMIN", dbRole: "ADMIN", staffRole: ORDINARY_ROLE });

    await requirePermission("payments.record"); // mutates: true
    expect(mockedRecordAudit).toHaveBeenCalledTimes(1);

    mockedRecordAudit.mockClear();

    await requirePermission("payments.view"); // mutates: false
    expect(mockedRecordAudit).not.toHaveBeenCalled();
  });
});
