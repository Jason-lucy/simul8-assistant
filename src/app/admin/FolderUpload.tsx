"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { isAllowedKnowledgeFile } from "@/lib/upload-allowlist";

type Props = {
  disabled?: boolean;
  onDone: () => Promise<void> | void;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
};

type Progress = {
  current: number;
  total: number;
  fileName: string;
};

async function readEntryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function readAllEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  const out: FileSystemEntry[] = [];
  for (;;) {
    const batch: FileSystemEntry[] = await new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch.length) break;
    out.push(...batch);
  }
  return out;
}

async function walkEntry(
  entry: FileSystemEntry,
  pathPrefix = "",
): Promise<File[]> {
  if (entry.isFile) {
    const file = await readEntryFile(entry as FileSystemFileEntry);
    const relative = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
    Object.defineProperty(file, "webkitRelativePath", {
      value: relative,
      configurable: true,
    });
    return [file];
  }
  if (entry.isDirectory) {
    const dir = entry as FileSystemDirectoryEntry;
    const reader = dir.createReader();
    const children = await readAllEntries(reader);
    const nextPrefix = pathPrefix ? `${pathPrefix}/${dir.name}` : dir.name;
    const nested = await Promise.all(
      children.map((child) => walkEntry(child, nextPrefix)),
    );
    return nested.flat();
  }
  return [];
}

export function FolderUpload({ disabled, onDone, onMessage, onError }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [lastSummary, setLastSummary] = useState("");

  const busy = disabled || uploading;

  const acceptLabel = useMemo(
    () => ".md / .txt / .csv / .json / .html 等文本文件",
    [],
  );

  const uploadFiles = useCallback(
    async (incoming: File[]) => {
      const files = incoming.filter(
        (f) => f.size > 0 && isAllowedKnowledgeFile(f.name),
      );
      const skipped = incoming.length - files.length;

      if (files.length === 0) {
        onError(
          skipped > 0
            ? `选中 ${incoming.length} 个文件，但没有可导入的文本文件（${acceptLabel}）`
            : "没有可上传的文件",
        );
        return;
      }

      setUploading(true);
      onError("");
      onMessage("");
      setLastSummary("");

      let imported = 0;
      let failed = 0;
      const batchSize = 20;

      try {
        for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize);
          setProgress({
            current: Math.min(i + batch.length, files.length),
            total: files.length,
            fileName: batch[batch.length - 1]?.name || "",
          });

          const form = new FormData();
          for (const file of batch) {
            form.append("files", file, file.name);
            const relative =
              (file as File & { webkitRelativePath?: string })
                .webkitRelativePath || file.name;
            form.append("paths", relative);
          }

          const res = await fetch("/api/admin/documents/batch", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "批量上传失败");
          }
          imported += data.summary?.imported || 0;
          failed += data.summary?.failed || 0;
        }

        const summary = `导入完成：成功 ${imported} 个${
          failed ? `，失败 ${failed} 个` : ""
        }${skipped ? `，跳过不支持类型 ${skipped} 个` : ""}`;
        setLastSummary(summary);
        onMessage(summary);
        await onDone();
      } catch (err) {
        onError(err instanceof Error ? err.message : "上传失败");
      } finally {
        setUploading(false);
        setProgress(null);
      }
    },
    [acceptLabel, onDone, onError, onMessage],
  );

  async function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;

    const items = e.dataTransfer.items;
    if (items?.length) {
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
      if (entries.length) {
        const nested = await Promise.all(entries.map((en) => walkEntry(en)));
        await uploadFiles(nested.flat());
        return;
      }
    }

    const list = e.dataTransfer.files;
    await uploadFiles(Array.from(list || []));
  }

  return (
    <div className="space-y-3">
      <div
        className={`rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
          dragging
            ? "border-[var(--accent)] bg-[#d9eef5]"
            : "border-[var(--line)] bg-[#f8fafc]"
        } ${busy ? "opacity-60" : "cursor-pointer"}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        onClick={() => {
          if (!busy) folderInputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            folderInputRef.current?.click();
          }
        }}
      >
        <div
          className="mb-2 text-lg font-semibold"
          style={{ fontFamily: "var(--font-sora), sans-serif" }}
        >
          拖拽文件夹 / 文件到这里
        </div>
        <p className="mx-auto max-w-xl text-sm text-[var(--muted)]">
          把本地「Simul8知识库」文件夹直接拖进来即可批量入库。也支持点击选择整个文件夹。
          <br />
          当前支持：{acceptLabel}
        </p>
        {progress ? (
          <p className="mt-4 text-sm text-[var(--accent)]">
            正在导入 {progress.current}/{progress.total}：{progress.fileName}
          </p>
        ) : null}
        {lastSummary ? (
          <p className="mt-3 text-sm text-[var(--accent)]">{lastSummary}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => folderInputRef.current?.click()}
        >
          选择文件夹上传
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          选择多个文件
        </button>
      </div>

      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length) uploadFiles(Array.from(list));
          e.target.value = "";
        }}
        {...({
          webkitdirectory: "",
          directory: "",
        } as React.InputHTMLAttributes<HTMLInputElement>)}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".md,.markdown,.txt,.csv,.json,.html,.htm,.log,.xml,.yml,.yaml"
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length) uploadFiles(Array.from(list));
          e.target.value = "";
        }}
      />
    </div>
  );
}
