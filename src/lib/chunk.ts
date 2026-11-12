export function chunkText(text: string, opts?: { size?: number; overlap?: number }) {
  const size = opts?.size ?? 800;
  const overlap = opts?.overlap ?? 120;
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [] as string[];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).trim().length <= size) {
      current = current ? `${current}\n\n${para}` : para;
      continue;
    }
    if (current) pushCurrent();
    if (para.length <= size) {
      current = para;
      continue;
    }
    for (let i = 0; i < para.length; i += size - overlap) {
      chunks.push(para.slice(i, i + size).trim());
    }
    current = "";
  }
  pushCurrent();
  return chunks.filter(Boolean);
}
