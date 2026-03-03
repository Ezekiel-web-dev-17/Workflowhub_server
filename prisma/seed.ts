import { PrismaClient } from "../src/generated/prisma/client.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  accelerateUrl: process.env["DATABASE_URL"]!,
});

async function main(): Promise<void> {
  console.log("🌱 Starting database seed...");

  // Create admin user
  const adminPassword = await bcrypt.hash("Admin123!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@workflowhub.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@workflowhub.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  // Create test user
  const userPassword = await bcrypt.hash("User1234!", 12);
  const user = await prisma.user.upsert({
    where: { email: "user@workflowhub.com" },
    update: {},
    create: {
      name: "Test User",
      email: "user@workflowhub.com",
      password: userPassword,
      role: "USER",
    },
  });

  console.log("✅ Seed complete:", { admin: admin.email, user: user.email });
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
