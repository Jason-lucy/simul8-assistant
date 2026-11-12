/**
 * Batch import Markdown/TXT files from ./knowledge-import into the app DB.
 * Usage:
 *   npx tsx scripts/import-from-folder.ts
 *   npx tsx scripts/import-from-folder.ts ./path/to/exported-ima-notes
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { chunkText } from "../src/lib/chunk";
import { embedTexts, embeddingConfigured } from "../src/lib/llm";

const prisma = new PrismaClient();

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(md|markdown|txt)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

async function ingestFile(filePath: string, root: string) {
  const content = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(root, filePath);
  const title = path.basename(filePath, path.extname(filePath));
  const pieces = chunkText(content);
  if (pieces.length === 0) {
    console.log(`skip empty: ${rel}`);
    return;
  }

  const doc = await prisma.document.create({
    data: {
      title,
      source: rel,
      mimeType: "text/plain",
      content,
      status: "PROCESSING",
    },
  });

  try {
    let embeddings: number[][] | null = null;
    if (embeddingConfigured()) {
      embeddings = [];
      for (let i = 0; i < pieces.length; i += 16) {
        embeddings.push(...(await embedTexts(pieces.slice(i, i + 16))));
      }
    }
    for (let i = 0; i < pieces.length; i++) {
      const created = await prisma.chunk.create({
        data: {
          documentId: doc.id,
          content: pieces[i],
          chunkIndex: i,
        },
      });
      if (embeddings?.[i]) {
        await prisma.$executeRawUnsafe(
          `UPDATE "Chunk" SET embedding = $1::vector WHERE id = $2`,
          toVectorLiteral(embeddings[i]),
          created.id,
        );
      }
    }
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "READY" },
    });
    console.log(`imported: ${rel} (${pieces.length} chunks)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "failed";
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "FAILED", errorMsg: msg },
    });
    console.error(`failed: ${rel} -> ${msg}`);
  }
}

async function main() {
  const root = path.resolve(process.argv[2] || "knowledge-import");
  if (!fs.existsSync(root)) {
    console.error(`Folder not found: ${root}`);
    process.exit(1);
  }
  const files = walk(root);
  console.log(`Found ${files.length} files under ${root}`);
  for (const file of files) {
    await ingestFile(file, root);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
