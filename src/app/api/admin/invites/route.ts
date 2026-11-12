import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  const invites = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ invites });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
    maxUses?: number;
  };
  const code =
    body.code?.trim() ||
    `S8-${randomBytes(4).toString("hex").toUpperCase()}`;
  const invite = await prisma.inviteCode.create({
    data: {
      code,
      maxUses: body.maxUses && body.maxUses > 0 ? body.maxUses : 20,
      createdBy: user.id,
    },
  });
  return NextResponse.json({ invite });
}
