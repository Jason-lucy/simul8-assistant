import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  const llm = await prisma.userLlmConfig.findUnique({
    where: { userId: user.id },
    select: { baseUrl: true, model: true, apiKeyLast4: true, updatedAt: true },
  });
  return NextResponse.json({ user, llmConfig: llm });
}
