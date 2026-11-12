/**
 * Export Simul8 knowledge from IMA into app DB (resumable).
 * Usage: npx tsx scripts/import-from-ima.ts [kb_id]
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { ingestDocument } from "../src/lib/ingest";

const prisma = new PrismaClient();
const KB_ID = process.argv[2] || "ima_kb_SlMygxlA";
const IMA_API = path.resolve(
  process.env.USERPROFILE || process.env.HOME || "",
  ".agents/skills/ima-skill/ima_api.cjs",
);
const EXPORT_DIR = path.resolve("knowledge-import/ima-export");
const SCAN_FILE = path.resolve("knowledge-import/ima-scan.json");
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

type KbItem = {
  media_id: string;
  title: string;
  parent_folder_id?: string;
  media_type: number;
};

function sleepMs(ms: number) {
  spawnSync(process.execPath, ["-e", `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,${ms})`], {
    stdio: "ignore",
  });
}

function ima(apiPath: string, body: unknown, retries = 8): any {
  for (let attempt = 0; attempt <= retries; attempt++) {
    sleepMs(400);
    const r = spawnSync(
      process.execPath,
      [IMA_API, apiPath, JSON.stringify(body), "{}"],
      { encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
    );
    const raw = (r.stdout || r.stderr || "").trim();
    let json: any = {};
    try {
      json = JSON.parse(raw || "{}");
    } catch {
      sleepMs(2000 * (attempt + 1));
      continue;
    }
    if (r.status === 0 && json.code === 0) return json.data;
    const msg = String(json.msg || raw || "");
    if (/频率|限流|rate|稍后|超限/i.test(msg) && attempt < retries) {
      console.log(`  rate-limited, retry ${attempt + 1}...`);
      sleepMs(3000 * (attempt + 1));
      continue;
    }
    throw new Error(msg || `IMA failed: ${apiPath}`);
  }
  throw new Error(`IMA failed after retries: ${apiPath}`);
}

function listFolder(folderId?: string): KbItem[] {
  const items: KbItem[] = [];
  let cursor = "";
  for (;;) {
    const data = ima("openapi/wiki/v1/get_knowledge_list", {
      knowledge_base_id: KB_ID,
      ...(folderId ? { folder_id: folderId } : {}),
      cursor,
      limit: 50,
    });
    items.push(...(data.knowledge_list || []));
    if (data.is_end) break;
    cursor = data.next_cursor || "";
    if (!cursor) break;
  }
  return items;
}

type ScanState = {
  foldersDone: string[];
  pendingFolders: string[];
  files: KbItem[];
};

function loadScan(): ScanState {
  if (!fs.existsSync(SCAN_FILE)) {
    return { foldersDone: [], pendingFolders: [], files: [] };
  }
  return JSON.parse(fs.readFileSync(SCAN_FILE, "utf8"));
}

function saveScan(state: ScanState) {
  fs.mkdirSync(path.dirname(SCAN_FILE), { recursive: true });
  fs.writeFileSync(SCAN_FILE, JSON.stringify(state, null, 2), "utf8");
}

function scanAll(): KbItem[] {
  const state = loadScan();
  const done = new Set(state.foldersDone);
  const fileMap = new Map(state.files.map((f) => [f.media_id, f]));
  const queue: string[] = [...state.pendingFolders];

  if (!done.has("__root__")) {
    console.log("Scanning root...");
    const rootItems = listFolder(undefined);
    done.add("__root__");
    for (const it of rootItems) {
      if (it.media_type === 99) {
        if (!done.has(it.media_id) && !queue.includes(it.media_id)) queue.push(it.media_id);
      } else {
        fileMap.set(it.media_id, it);
      }
    }
    saveScan({
      foldersDone: [...done],
      pendingFolders: [...queue],
      files: [...fileMap.values()],
    });
  }

  while (queue.length) {
    const folderId = queue.shift()!;
    if (done.has(folderId)) {
      saveScan({
        foldersDone: [...done],
        pendingFolders: [...queue],
        files: [...fileMap.values()],
      });
      continue;
    }
    console.log(
      `Scanning folder ${folderId} (files ${fileMap.size}, queue ${queue.length})`,
    );
    try {
      const items = listFolder(folderId);
      done.add(folderId);
      for (const it of items) {
        if (it.media_type === 99) {
          if (!done.has(it.media_id) && !queue.includes(it.media_id)) {
            queue.push(it.media_id);
          }
        } else {
          fileMap.set(it.media_id, it);
        }
      }
      saveScan({
        foldersDone: [...done],
        pendingFolders: [...queue],
        files: [...fileMap.values()],
      });
    } catch (err) {
      saveScan({
        foldersDone: [...done],
        pendingFolders: [folderId, ...queue],
        files: [...fileMap.values()],
      });
      throw err;
    }
  }

  return [...fileMap.values()];
}

async function fetchMediaText(mediaId: string, title: string, mediaType: number) {
  if ([4, 5, 9, 13, 14, 15, 20, 21].includes(mediaType)) {
    return {
      text: `【资料索引】\n标题: ${title}\n类型: media_type=${mediaType}\n来源: IMA「Simul8知识库」\n说明: 完整文件请在 IMA 中打开；助手已收录标题便于检索。`,
      ext: "stub",
    };
  }

  const data = ima("openapi/wiki/v1/get_media_info", { media_id: mediaId });
  if (data.media_type === 11 && data.notebook_ext_info?.notebook_id) {
    const note = ima("openapi/note/v1/get_doc_content", {
      note_id: data.notebook_ext_info.notebook_id,
      target_content_format: 0,
    });
    const text =
      note?.content || note?.doc_content || note?.text || JSON.stringify(note).slice(0, 20000);
    return { text: String(text), ext: "md" };
  }

  const url = data.url_info?.url as string | undefined;
  const headers = (data.url_info?.headers || {}) as Record<string, string>;
  if (!url) return null;

  sleepMs(200);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_DOWNLOAD_BYTES) throw new Error(`too large ${buf.length}`);

  const lower = title.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt") || mediaType === 7) {
    return { text: buf.toString("utf8"), ext: "md" };
  }
  if (lower.endsWith(".pdf") || mediaType === 1) {
    try {
      const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string }>;
      const parsed = await pdfParse(buf);
      return { text: parsed.text || "", ext: "pdf" };
    } catch {
      return {
        text: `【PDF 索引】\n标题: ${title}\n来源: IMA「Simul8知识库」`,
        ext: "pdf",
      };
    }
  }
  if (lower.endsWith(".docx") || mediaType === 3) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      return { text: result.value || "", ext: "docx" };
    } catch {
      return {
        text: `【Word 索引】\n标题: ${title}\n来源: IMA「Simul8知识库」`,
        ext: "docx",
      };
    }
  }
  return {
    text: `【资料索引】\n标题: ${title}\n类型: media_type=${mediaType}\n来源: IMA「Simul8知识库」`,
    ext: "stub",
  };
}

function safeName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 120);
}

async function main() {
  if (!fs.existsSync(IMA_API)) throw new Error(`missing ${IMA_API}`);
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  console.log(`Scanning IMA KB ${KB_ID} (resumable -> ${SCAN_FILE})`);
  const files = scanAll();
  console.log(`Found ${files.length} files`);

  const priority = (t: number) => (t === 7 || t === 11 ? 0 : t === 3 ? 1 : t === 1 ? 2 : 3);
  files.sort((a, b) => priority(a.media_type) - priority(b.media_type));

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const [idx, file] of files.entries()) {
    const source = `ima://${KB_ID}/${file.media_id}`;
    const existing = await prisma.document.findFirst({ where: { source } });
    if (existing?.status === "READY") {
      skip++;
      continue;
    }
    process.stdout.write(`[${idx + 1}/${files.length}] ${file.title} ... `);
    try {
      const fetched = await fetchMediaText(file.media_id, file.title, file.media_type);
      if (!fetched?.text?.trim()) {
        console.log("empty");
        fail++;
        continue;
      }
      const ext = fetched.ext === "md" ? "md" : "txt";
      fs.writeFileSync(path.join(EXPORT_DIR, `${safeName(file.title)}.${ext}`), fetched.text, "utf8");
      await ingestDocument({
        title: file.title,
        content: fetched.text,
        source,
        mimeType: "text/plain",
        documentId: existing?.id,
      });
      ok++;
      console.log("ok");
    } catch (err) {
      fail++;
      console.log(`fail: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nDone. imported=${ok} skipped=${skip} failed=${fail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
