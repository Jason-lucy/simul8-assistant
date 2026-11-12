import { prisma } from "./db";
import { createOpenAIClient, embedTexts, embeddingConfigured } from "./llm";
import { decryptSecret } from "./crypto";

export type Citation = {
  documentId: string;
  title: string;
  source?: string | null;
  chunkIndex: number;
  excerpt: string;
  score?: number;
};

type Retrieved = {
  id: string;
  content: string;
  chunkIndex: number;
  documentId: string;
  title: string;
  source: string | null;
  score: number;
};

async function vectorSearch(query: string, topK: number): Promise<Retrieved[]> {
  const [queryVec] = await embedTexts([query]);
  const literal = `[${queryVec.join(",")}]`;
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      content: string;
      chunkIndex: number;
      documentId: string;
      title: string;
      source: string | null;
      score: number;
    }>
  >(
    `
    SELECT c.id, c.content, c."chunkIndex", c."documentId",
           d.title, d.source,
           1 - (c.embedding <=> $1::vector) AS score
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE d.status = 'READY' AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> $1::vector
    LIMIT $2
    `,
    literal,
    topK,
  );
  return rows;
}

async function keywordSearch(query: string, topK: number): Promise<Retrieved[]> {
  const tokens = query
    .split(/[\s,，。？?！!；;：:、]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);

  if (tokens.length === 0) return [];

  const docs = await prisma.chunk.findMany({
    where: {
      document: { status: "READY" },
      OR: tokens.map((t) => ({ content: { contains: t, mode: "insensitive" as const } })),
    },
    include: { document: true },
    take: topK * 4,
  });

  const scored = docs
    .map((c) => {
      const lower = c.content.toLowerCase();
      const score = tokens.reduce(
        (acc, t) => acc + (lower.includes(t.toLowerCase()) ? 1 : 0),
        0,
      );
      return {
        id: c.id,
        content: c.content,
        chunkIndex: c.chunkIndex,
        documentId: c.documentId,
        title: c.document.title,
        source: c.document.source,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

export async function retrieveContext(query: string, topK = 6): Promise<Retrieved[]> {
  if (embeddingConfigured()) {
    try {
      return await vectorSearch(query, topK);
    } catch (err) {
      if (process.env.ALLOW_KEYWORD_FALLBACK === "true") {
        return keywordSearch(query, topK);
      }
      throw err;
    }
  }
  if (process.env.ALLOW_KEYWORD_FALLBACK === "true") {
    return keywordSearch(query, topK);
  }
  throw new Error("未配置 Embedding API，且未开启关键词回退");
}

export async function answerWithRag(opts: {
  userId: string;
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const config = await prisma.userLlmConfig.findUnique({
    where: { userId: opts.userId },
  });
  if (!config) {
    throw new Error("请先在设置中配置你的 LLM API");
  }

  const retrieved = await retrieveContext(opts.question, 6);
  const citations: Citation[] = retrieved.map((r) => ({
    documentId: r.documentId,
    title: r.title,
    source: r.source,
    chunkIndex: r.chunkIndex,
    excerpt: r.content.slice(0, 240),
    score: r.score,
  }));

  const contextBlock =
    retrieved.length === 0
      ? "（知识库中未检索到相关片段）"
      : retrieved
          .map(
            (r, i) =>
              `[#${i + 1}] 标题: ${r.title}${r.source ? ` | 来源: ${r.source}` : ""}\n${r.content}`,
          )
          .join("\n\n");

  const system = `你是公司内部的 Simul8 知识问答助手。请基于提供的知识库片段回答。
规则：
1. 优先依据知识库内容，不要编造不存在的 Simul8 功能。
2. 若知识库不足，明确说明不确定，并给出可验证的建议。
3. 回答使用简体中文，结构清晰，必要时用步骤列表。
4. 在相关处用 [#编号] 标注引用来源。`;

  const apiKey = decryptSecret(config.apiKeyEncrypted);
  const client = createOpenAIClient(config.baseUrl, apiKey);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
    ...(opts.history ?? []).slice(-8),
    {
      role: "user",
      content: `知识库片段：\n${contextBlock}\n\n用户问题：${opts.question}`,
    },
  ];

  const completion = await client.chat.completions.create({
    model: config.model,
    messages,
    temperature: 0.2,
  });

  const answer =
    completion.choices[0]?.message?.content?.trim() ||
    "模型未返回内容，请检查你的 API 配置。";

  return { answer, citations, retrievedCount: retrieved.length };
}
