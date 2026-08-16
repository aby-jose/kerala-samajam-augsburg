/**
 * Seeds the six preset roles and backfills existing administrators.
 *
 * Step 2 is the one that matters: without it every current administrator keeps
 * the portal gate but holds no permissions, and the site becomes
 * unadministrable the moment the new guard ships. Idempotent — safe to re-run.
 *
 * Run with: npx tsx prisma/seed-roles.ts
 */
import { PrismaClient } from "@prisma/client";
import { ROLE_PRESETS } from "../src/lib/rbac/presets";

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

  // 2. Backfill. Every existing administrator becomes a Super Admin.
  const superAdmin = await prisma.role.findUnique({ where: { name: "Super Admin" } });
  if (!superAdmin) throw new Error("Super Admin role missing after seeding");

  const orphans = await prisma.user.findMany({
    where: { role: "ADMIN", staffRoleId: null },
    select: { id: true, email: true },
  });

  for (const user of orphans) {
    await prisma.user.update({
      where: { id: user.id },
      data: { staffRoleId: superAdmin.id },
    });
    console.log(`  ↑ ${user.email} → Super Admin`);
  }

  console.log(`\nDone. ${orphans.length} administrator(s) backfilled.`);

  const stillOrphaned = await prisma.user.count({
    where: { role: "ADMIN", staffRoleId: null },
  });
  if (stillOrphaned > 0) throw new Error(`${stillOrphaned} admins still have no role`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
