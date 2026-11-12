import OpenAI from "openai";

export function createOpenAIClient(baseUrl: string, apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: baseUrl.replace(/\/$/, ""),
  });
}

export async function testChatConnection(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
}) {
  const client = createOpenAIClient(opts.baseUrl, opts.apiKey);
  const res = await client.chat.completions.create({
    model: opts.model,
    messages: [{ role: "user", content: "ping" }],
    max_tokens: 5,
  });
  return Boolean(res.choices?.[0]?.message);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const baseUrl = process.env.EMBEDDING_BASE_URL;
  const apiKey = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
  if (!baseUrl || !apiKey) {
    throw new Error("EMBEDDING_NOT_CONFIGURED");
  }
  const client = createOpenAIClient(baseUrl, apiKey);
  const res = await client.embeddings.create({
    model,
    input: texts,
  });
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding as number[]);
}

export function embeddingConfigured() {
  return Boolean(process.env.EMBEDDING_BASE_URL && process.env.EMBEDDING_API_KEY);
}
