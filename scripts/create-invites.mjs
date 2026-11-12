import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const codes = ["SIMUL8-MARKET", "SIMUL8-TEAM-01", "SIMUL8-TEAM-02"];

for (const code of codes) {
  await prisma.inviteCode.upsert({
    where: { code },
    create: { code, maxUses: 100 },
    update: {},
  });
}

const invites = await prisma.inviteCode.findMany({ orderBy: { createdAt: "desc" } });
for (const i of invites) {
  console.log(`${i.code}\t${i.usedCount}/${i.maxUses}`);
}
await prisma.$disconnect();
