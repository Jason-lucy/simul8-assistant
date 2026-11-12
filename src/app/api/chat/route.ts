import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { answerWithRag } from "@/lib/rag";

const schema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(8000),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const body = schema.parse(await req.json());
    let sessionId = body.sessionId;
    if (!sessionId) {
      const session = await prisma.chatSession.create({
        data: {
          userId: user.id,
          title: body.message.slice(0, 40),
        },
      });
      sessionId = session.id;
    } else {
      const owned = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: user.id },
      });
      if (!owned) {
        return NextResponse.json({ error: "会话不存在" }, { status: 404 });
      }
    }

    const historyRows = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 16,
    });

    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "user",
        content: body.message,
      },
    });

    const history = historyRows
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const result = await answerWithRag({
      userId: user.id,
      question: body.message,
      history,
    });

    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: result.answer,
        citations: result.citations,
      },
    });

    await prisma.chatSession.update({
      where: { id: sessionId },
      data:
        historyRows.length === 0
          ? { title: body.message.slice(0, 40) }
          : { updatedAt: new Date() },
    });

    return NextResponse.json({
      sessionId,
      answer: result.answer,
      citations: result.citations,
      retrievedCount: result.retrievedCount,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "参数不合法" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "问答失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
