/**
 * Seeds the six preset roles and backfills existing administrators.
 *
 * Step 2 is the one that matters: without it every current administrator keeps
 * the portal gate but holds no permissions, and the site becomes
 * unadministrable the moment the new guard ships. Idempotent — safe to re-run.
 *
 * Run with: npm run seed:roles
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { ROLE_PRESETS } from "../src/lib/rbac/presets";

// Same as prisma/seed.ts — without this, DATABASE_URL only resolves when the
// shell already has it exported, which is not how this repo's local/CI
// environments are set up.
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  // 1. Presets. Existing roles are left alone — the committee may have edited
  //    them, and this script must never undo that.
  for (const preset of ROLE_PRESETS) {
    const existing = await prisma.role.findUnique({ where: { name: preset.name } });
    if (existing) {
      console.log(`  = ${preset.name} (exists, untouched)`);
      continue;
    }
    await prisma.role.create({
      data: {
        name: preset.name,
        description: preset.description,
        permissions: preset.permissions,
        isSystem: preset.isSystem,
      },
    });
    console.log(`  + ${preset.name} (${preset.permissions.length} permissions)`);
  }

  // 2. Backfill. Every existing administrator becomes a Super Admin — active
  //    ones (`role: "ADMIN"`) and currently-suspended ones
  //    (`role: "SUSPENDED_ADMIN"`) alike. Suspension is encoded as a prefix
  //    on `role` (see `suspendUser` in membership-actions.ts), so a
  //    suspended administrator would otherwise fall through this filter
  //    entirely: `staffRoleId` stays null, and reinstating them later
  //    (which only strips the prefix) hands back the portal gate with zero
  //    permissions — the same "ADMIN in name, no permissions" hole this
  //    seed exists to close, just deferred until whoever reinstates them.
  const superAdmin = await prisma.role.findUnique({ where: { name: "Super Admin" } });
  if (!superAdmin) throw new Error("Super Admin role missing after seeding");

  const ADMIN_ROLES = ["ADMIN", "SUSPENDED_ADMIN"];

  const orphans = await prisma.user.findMany({
    where: { role: { in: ADMIN_ROLES }, staffRoleId: null },
    select: { id: true, email: true, role: true },
  });

  for (const user of orphans) {
    await prisma.user.update({
      where: { id: user.id },
      data: { staffRoleId: superAdmin.id },
    });
    const suspended = user.role === "SUSPENDED_ADMIN" ? " (currently suspended)" : "";
    console.log(`  ↑ ${user.email} → Super Admin${suspended}`);
  }

  console.log(`\nDone. ${orphans.length} administrator(s) backfilled.`);

  const stillOrphaned = await prisma.user.count({
    where: { role: { in: ADMIN_ROLES }, staffRoleId: null },
  });
  if (stillOrphaned > 0) throw new Error(`${stillOrphaned} admins still have no role`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
