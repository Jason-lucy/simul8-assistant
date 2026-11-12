export const TEXT_UPLOAD_EXTENSIONS = [
  ".md",
  ".markdown",
  ".txt",
  ".csv",
  ".json",
  ".html",
  ".htm",
  ".log",
  ".xml",
  ".yml",
  ".yaml",
] as const;

export function isAllowedKnowledgeFile(name: string) {
  const lower = name.toLowerCase();
  return TEXT_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function titleFromFilename(name: string) {
  return name.replace(/\.[^.]+$/, "").split(/[/\\]/).pop() || name;
}
