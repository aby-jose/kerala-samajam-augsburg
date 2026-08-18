import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import * as dotenv from "dotenv";
import { ROLE_PRESETS } from "../src/lib/rbac/presets";

dotenv.config();

const prisma = new PrismaClient();

/**
 * Without both of these, the seeded admin can sign in (the JWT genuinely
 * carries `role: "ADMIN"`) but every dashboard page redirects straight back
 * to /admin/login: `getStaffContext()` requires a real `staffRole` relation,
 * and the login page's own client-side check only looks at the JWT's role
 * claim — so the two disagree forever. See prisma/seed-roles.ts, which
 * backfills this for admins created before the RBAC guard shipped; this
 * seed creates one fresh, so it has to do the same thing itself rather than
 * depending on that script having been run afterward.
 */
async function ensureSuperAdminRoleId(): Promise<string> {
  const preset = ROLE_PRESETS.find((p) => p.name === "Super Admin");
  if (!preset) throw new Error("Super Admin preset missing from ROLE_PRESETS");

  const role = await prisma.role.upsert({
    where: { name: preset.name },
    update: {},
    create: {
      name: preset.name,
      description: preset.description,
      permissions: preset.permissions,
      isSystem: preset.isSystem,
    },
  });

  return role.id;
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@ksaugsburg.de";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  console.log("Seeding started...");

  const superAdminRoleId = await ensureSuperAdminRoleId();

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`Admin with email ${adminEmail} already exists.`);

    // Backfill: this row may predate emailVerified/staffRoleId being set at
    // creation time (exactly the login/dashboard redirect loop this file
    // used to cause). Idempotent — only touches what's actually missing.
    const needsEmailVerified = !existingAdmin.emailVerified;
    const needsStaffRole = !existingAdmin.staffRoleId;

    if (needsEmailVerified || needsStaffRole) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          ...(needsEmailVerified && { emailVerified: new Date() }),
          ...(needsStaffRole && { staffRoleId: superAdminRoleId }),
        },
      });
      console.log(
        `  Backfilled: ${[needsEmailVerified && "emailVerified", needsStaffRole && "staffRoleId"]
          .filter(Boolean)
          .join(", ")}`
      );
    } else {
      console.log("  Already has emailVerified and staffRoleId. Skipping.");
    }
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        name: "Admin User",
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
        emailVerified: new Date(),
        staffRoleId: superAdminRoleId,
      },
    });

    console.log(`Admin user created:`);
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
  }

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
