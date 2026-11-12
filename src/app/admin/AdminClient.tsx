"use client";

import { FormEvent, useEffect, useState } from "react";

type Doc = {
  id: string;
  title: string;
  source: string | null;
  status: string;
  errorMsg: string | null;
  createdAt: string;
  _count: { chunks: number };
};

type Invite = {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  createdAt: string;
};

export function AdminClient() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const [d, i] = await Promise.all([
      fetch("/api/admin/documents").then((r) => r.json()),
      fetch("/api/admin/invites").then((r) => r.json()),
    ]);
    setDocs(d.documents || []);
    setInvites(i.invites || []);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  async function uploadText(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, source }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "导入失败");
      return;
    }
    setTitle("");
    setSource("");
    setContent("");
    setMessage(`已导入：${data.document.title}`);
    await refresh();
  }

  async function uploadFile(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setMessage("");
    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    if (source) form.append("source", source);
    const res = await fetch("/api/admin/documents", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "上传失败");
      return;
    }
    setFile(null);
    setMessage(`已上传：${data.document.title}`);
    await refresh();
  }

  async function createInvite() {
    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxUses: 50 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "创建邀请码失败");
      return;
    }
    setMessage(`新邀请码：${data.invite.code}`);
    await refresh();
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2
          className="mb-2 text-xl font-semibold"
          style={{ fontFamily: "var(--font-sora), sans-serif" }}
        >
          导入知识
        </h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          支持粘贴 Markdown/纯文本，或上传 .md/.txt 文件。也可把从 IMA
          导出的材料放到 knowledge-import/ 后运行导入脚本。
        </p>

        <form onSubmit={uploadText} className="mb-6 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="field mb-0">
              <label className="label">标题</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="field mb-0">
              <label className="label">来源（可选）</label>
              <input
                className="input"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="官方文档 / 内部笔记 / URL"
              />
            </div>
          </div>
          <div className="field mb-0">
            <label className="label">正文</label>
            <textarea
              className="textarea min-h-[180px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary w-fit" disabled={loading}>
            写入知识库
          </button>
        </form>

        <form onSubmit={uploadFile} className="flex flex-wrap items-end gap-3">
          <div className="field mb-0">
            <label className="label">上传文件</label>
            <input
              className="input"
              type="file"
              accept=".md,.txt,.markdown,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <button className="btn btn-secondary" disabled={loading || !file}>
            上传并切片
          </button>
        </form>

        {error ? <p className="error mt-3">{error}</p> : null}
        {message ? (
          <p className="mt-3 text-sm text-[var(--accent)]">{message}</p>
        ) : null}
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">邀请码</h3>
          <button className="btn btn-secondary" onClick={createInvite}>
            生成邀请码
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="py-2">Code</th>
                <th>已用/上限</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id} className="border-b border-[var(--line)]">
                  <td className="py-2 font-mono">{i.code}</td>
                  <td>
                    {i.usedCount}/{i.maxUses}
                  </td>
                  <td>{new Date(i.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="mb-3 text-lg font-semibold">已入库文档</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="py-2">标题</th>
                <th>状态</th>
                <th>切片数</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-[var(--line)]">
                  <td className="py-2">{d.title}</td>
                  <td>
                    {d.status}
                    {d.errorMsg ? ` (${d.errorMsg})` : ""}
                  </td>
                  <td>{d._count.chunks}</td>
                  <td className="max-w-[240px] truncate">{d.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
