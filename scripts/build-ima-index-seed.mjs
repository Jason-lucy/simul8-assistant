/**
 * Build searchable title-index markdown from ima-scan.json (no binary download).
 * Safe to commit for handoff when full IMA text export is incomplete.
 */
import fs from "fs";
import path from "path";

const scanPath = path.resolve("knowledge-import/ima-scan.json");
const outDir = path.resolve("knowledge-import/seed");
const outFile = path.join(outDir, "04-ima-simul8-catalog-index.md");

if (!fs.existsSync(scanPath)) {
  console.error("Missing knowledge-import/ima-scan.json — run import:ima scan first.");
  process.exit(1);
}

const scan = JSON.parse(fs.readFileSync(scanPath, "utf8"));
const files = (scan.files || []).filter((f) => f.media_type !== 99);
const byType = new Map();
for (const f of files) {
  const t = String(f.media_type);
  if (!byType.has(t)) byType.set(t, []);
  byType.get(t).push(f.title);
}

const typeName = {
  1: "PDF",
  3: "Word",
  4: "PPT",
  5: "Excel",
  7: "Markdown",
  9: "图片",
  11: "笔记",
};

let md = `# Simul8 知识库目录索引（来自 IMA 扫描）

> 本文件由 IMA「Simul8知识库」目录扫描生成，用于问答检索定位资料标题。
> 完整正文可继续用管理后台上传，或本地执行 \`npm run import:ima\` 导入原文。

共收录 **${files.length}** 条资料标题。

`;

for (const [type, titles] of [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  md += `\n## ${typeName[type] || `类型 ${type}`}（${titles.length}）\n\n`;
  for (const title of titles.sort((a, b) => a.localeCompare(b, "zh"))) {
    md += `- ${title}\n`;
  }
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, md, "utf8");
console.log(`Wrote ${outFile} (${files.length} titles)`);
