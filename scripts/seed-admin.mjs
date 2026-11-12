import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@company.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "ChangeMeAdmin123!";
  const name = process.env.ADMIN_NAME || "Admin";
  const inviteCode = process.env.BOOTSTRAP_INVITE_CODE || "SIMUL8-WELCOME";

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
    },
    update: {
      name,
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.inviteCode.upsert({
    where: { code: inviteCode },
    create: {
      code: inviteCode,
      maxUses: 200,
      createdBy: admin.id,
    },
    update: {},
  });

  console.log(`Admin ready: ${admin.email}`);
  console.log(`Invite code ready: ${inviteCode}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
