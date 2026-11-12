import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const total = await p.document.count();
const ready = await p.document.count({ where: { status: "READY" } });
const ima = await p.document.count({
  where: { source: { startsWith: "ima://" } },
});
const docs = await p.document.findMany({
  select: {
    title: true,
    source: true,
    status: true,
    _count: { select: { chunks: true } },
  },
  orderBy: { createdAt: "asc" },
});
console.log(JSON.stringify({ total, ready, ima, docs }, null, 2));
await p.$disconnect();
