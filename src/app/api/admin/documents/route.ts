import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ingestDocument } from "@/lib/ingest";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });
  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "缺少文件" }, { status: 400 });
      }
      const text = await file.text();
      const title = (form.get("title") as string) || file.name;
      const source = (form.get("source") as string) || file.name;
      const doc = await ingestDocument({
        title,
        content: text,
        source,
        mimeType: file.type || "text/plain",
      });
      return NextResponse.json({ document: doc });
    }

    const body = (await req.json()) as {
      title?: string;
      content?: string;
      source?: string;
    };
    if (!body.title || !body.content) {
      return NextResponse.json({ error: "title 与 content 必填" }, { status: 400 });
    }
    const doc = await ingestDocument({
      title: body.title,
      content: body.content,
      source: body.source,
      mimeType: "text/plain",
    });
    return NextResponse.json({ document: doc });
  } catch (err) {
    const message = err instanceof Error ? err.message : "导入失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
