const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
require("dotenv").config();

const prisma = new PrismaClient();

async function check() {
  const email = "abyjoseofficial@gmail.com";
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log("User not found in DB");
    return;
  }

  console.log("User found:", user.email);
  console.log("Hashed password in DB:", user.password);
  
  const testPassword = "admin123";
  const match = await bcrypt.compare(testPassword, user.password);
  console.log(`Does 'admin123' match? ${match}`);
  
  await prisma.$disconnect();
}

check();
