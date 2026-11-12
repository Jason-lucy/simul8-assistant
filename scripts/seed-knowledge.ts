import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { ingestDocument } from "../src/lib/ingest";

const prisma = new PrismaClient();

async function main() {
  const seedDir = path.resolve("knowledge-import/seed");
  const files = fs
    .readdirSync(seedDir)
    .filter((f) => /\.(md|txt)$/i.test(f))
    .map((f) => path.join(seedDir, f));

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const title = path.basename(file, path.extname(file));
    const existing = await prisma.document.findFirst({
      where: { title, source: path.relative(process.cwd(), file) },
    });
    if (existing?.status === "READY") {
      console.log(`skip existing: ${title}`);
      continue;
    }
    await ingestDocument({
      title,
      content,
      source: path.relative(process.cwd(), file),
      mimeType: "text/markdown",
      documentId: existing?.id,
    });
    console.log(`seeded: ${title}`);
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
