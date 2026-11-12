import { prisma } from "./db";
import { chunkText } from "./chunk";
import { embedTexts, embeddingConfigured } from "./llm";

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

export async function ingestDocument(input: {
  title: string;
  content: string;
  source?: string;
  mimeType?: string;
  documentId?: string;
}) {
  const doc = input.documentId
    ? await prisma.document.update({
        where: { id: input.documentId },
        data: {
          title: input.title,
          content: input.content,
          source: input.source,
          mimeType: input.mimeType,
          status: "PROCESSING",
          errorMsg: null,
        },
      })
    : await prisma.document.create({
        data: {
          title: input.title,
          content: input.content,
          source: input.source,
          mimeType: input.mimeType,
          status: "PROCESSING",
        },
      });

  try {
    await prisma.chunk.deleteMany({ where: { documentId: doc.id } });
    const pieces = chunkText(input.content);
    if (pieces.length === 0) {
      throw new Error("文档内容为空，无法切片");
    }

    let embeddings: number[][] | null = null;
    if (embeddingConfigured()) {
      embeddings = [];
      const batchSize = 16;
      for (let i = 0; i < pieces.length; i += batchSize) {
        const batch = pieces.slice(i, i + batchSize);
        const vectors = await embedTexts(batch);
        embeddings.push(...vectors);
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

    return prisma.document.update({
      where: { id: doc.id },
      data: { status: "READY", errorMsg: null },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "导入失败";
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "FAILED", errorMsg: msg },
    });
    throw err;
  }
}
