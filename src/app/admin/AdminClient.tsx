"use client";

import { FormEvent, useEffect, useState } from "react";
import { FolderUpload } from "./FolderUpload";

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
          批量导入本地知识库
        </h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          把本地保存的 Simul8 知识库文件夹拖进来，或点选文件夹。导入后即可在「问答」里检索使用。
          PDF/PPT/Word 请先转成 Markdown/TXT 再上传（当前按文本入库）。
        </p>

        <FolderUpload
          disabled={loading}
          onDone={refresh}
          onMessage={setMessage}
          onError={setError}
        />

        {error ? <p className="error mt-3">{error}</p> : null}
        {message ? (
          <p className="mt-3 text-sm text-[var(--accent)]">{message}</p>
        ) : null}
      </section>

      <section className="card p-5">
        <h3 className="mb-3 text-lg font-semibold">单条粘贴导入（可选）</h3>
        <form onSubmit={uploadText} className="grid gap-3">
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
              className="textarea min-h-[140px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-secondary w-fit" disabled={loading}>
            写入知识库
          </button>
        </form>
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
        <h3 className="mb-3 text-lg font-semibold">
          已入库文档（{docs.length}）
        </h3>
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
                  <td className="max-w-[280px] truncate" title={d.source || ""}>
                    {d.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
