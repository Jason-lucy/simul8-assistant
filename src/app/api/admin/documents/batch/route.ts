import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ingestDocument } from "@/lib/ingest";
import {
  isAllowedKnowledgeFile,
  titleFromFilename,
} from "@/lib/upload-allowlist";

export const runtime = "nodejs";
export const maxDuration = 300;

type ResultItem = {
  name: string;
  ok: boolean;
  title?: string;
  documentId?: string;
  error?: string;
  skipped?: boolean;
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const files = form
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "未收到文件" }, { status: 400 });
    }
    if (files.length > 80) {
      return NextResponse.json(
        { error: "单次最多 80 个文件，请分批上传" },
        { status: 400 },
      );
    }

    const results: ResultItem[] = [];
    const pathList = form.getAll("paths").map((p) => String(p));

    for (const [index, file] of files.entries()) {
      const relative =
        pathList[index] ||
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;

      if (!isAllowedKnowledgeFile(file.name)) {
        results.push({
          name: relative,
          ok: false,
          skipped: true,
          error: "不支持的文件类型（仅文本类：md/txt/csv/json/html 等）",
        });
        continue;
      }

      try {
        const content = await file.text();
        if (!content.trim()) {
          results.push({
            name: relative,
            ok: false,
            skipped: true,
            error: "空文件",
          });
          continue;
        }

        const title = titleFromFilename(file.name);
        const doc = await ingestDocument({
          title,
          content,
          source: relative,
          mimeType: file.type || "text/plain",
        });
        results.push({
          name: relative,
          ok: true,
          title: doc.title,
          documentId: doc.id,
        });
      } catch (err) {
        results.push({
          name: relative,
          ok: false,
          error: err instanceof Error ? err.message : "导入失败",
        });
      }
    }

    const imported = results.filter((r) => r.ok).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.ok && !r.skipped).length;

    return NextResponse.json({
      ok: true,
      summary: { total: files.length, imported, skipped, failed },
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "批量上传失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
