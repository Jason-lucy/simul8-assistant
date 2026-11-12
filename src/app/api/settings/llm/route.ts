import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptSecret, last4 } from "@/lib/crypto";
import { testChatConnection } from "@/lib/llm";

const schema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(8).optional(),
  model: z.string().min(1),
  testOnly: z.boolean().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const config = await prisma.userLlmConfig.findUnique({
    where: { userId: user.id },
    select: { baseUrl: true, model: true, apiKeyLast4: true, updatedAt: true },
  });
  return NextResponse.json({ config });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const body = schema.parse(await req.json());
    const existing = await prisma.userLlmConfig.findUnique({
      where: { userId: user.id },
    });

    if (body.testOnly) {
      if (!body.apiKey && !existing) {
        return NextResponse.json({ error: "请先填写 API Key" }, { status: 400 });
      }
      const { decryptSecret } = await import("@/lib/crypto");
      const key = body.apiKey || decryptSecret(existing!.apiKeyEncrypted);
      await testChatConnection({
        baseUrl: body.baseUrl,
        apiKey: key,
        model: body.model,
      });
      return NextResponse.json({ ok: true, message: "连通测试成功" });
    }

    if (!body.apiKey && !existing) {
      return NextResponse.json({ error: "首次配置必须提供 API Key" }, { status: 400 });
    }

    const encrypted = body.apiKey
      ? encryptSecret(body.apiKey)
      : existing!.apiKeyEncrypted;
    const keyLast4 = body.apiKey ? last4(body.apiKey) : existing!.apiKeyLast4;

    const config = await prisma.userLlmConfig.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        baseUrl: body.baseUrl.replace(/\/$/, ""),
        apiKeyEncrypted: encrypted,
        apiKeyLast4: keyLast4,
        model: body.model,
      },
      update: {
        baseUrl: body.baseUrl.replace(/\/$/, ""),
        apiKeyEncrypted: encrypted,
        apiKeyLast4: keyLast4,
        model: body.model,
      },
      select: { baseUrl: true, model: true, apiKeyLast4: true, updatedAt: true },
    });

    return NextResponse.json({ ok: true, config });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "参数不合法" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
