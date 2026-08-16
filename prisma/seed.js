const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
require("dotenv").config();

const prisma = new PrismaClient({
  log: ["query", "error", "warn"],
});

async function main() {
  const rawEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Fail loudly rather than part-way through. Without the values, the first
  // query dies on "Argument `where` ... needs at least one of `id` or `email`"
  // and bcrypt on "data and salt arguments required" — neither of which points
  // at the actual problem, which is an unset variable in .env.
  const missing = [
    !rawEmail && "ADMIN_EMAIL",
    !adminPassword && "ADMIN_PASSWORD",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `${missing.join(" and ")} must be set in .env before seeding.`
    );
  }

  // Sign-in lowercases the address before looking it up (see
  // `authorizeCredentials` in src/lib/auth.ts), so an address stored with any
  // uppercase in it can never be matched and every attempt comes back as
  // "Invalid email or password."
  const adminEmail = rawEmail.trim().toLowerCase();

  console.log("Seeding started...");

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Upsert rather than skip-if-present.
  //
  // The previous form only ever wrote the password when no account existed, so
  // changing ADMIN_PASSWORD and re-running printed "already exists. Skipping..."
  // and left the old hash in place — and then sign-in kept failing with
  // "Invalid email or password." for a password that looked correct in .env.
  // Re-seeding is the documented way to reset admin access, so it has to
  // actually reset it.
  //
  // `name` is deliberately not in `update`: it is editable from the profile
  // page and re-seeding should not revert someone's chosen name.
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: hashedPassword, role: "ADMIN" },
    create: {
      name: "Admin User",
      email: adminEmail,
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log(`Admin user ready: ${admin.email} (role ${admin.role})`);
  console.log("Password set from ADMIN_PASSWORD in .env.");

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
