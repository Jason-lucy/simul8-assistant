"use client";

import { FormEvent, useEffect, useState } from "react";

type Citation = {
  title: string;
  source?: string | null;
  excerpt: string;
  chunkIndex: number;
};

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

type Session = { id: string; title: string };

export function ChatClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadSessions() {
    const res = await fetch("/api/chat/sessions");
    const data = await res.json();
    setSessions(data.sessions || []);
  }

  async function openSession(id: string) {
    setSessionId(id);
    setError("");
    const res = await fetch(`/api/chat/sessions/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "加载会话失败");
      return;
    }
    setMessages(
      (data.session.messages || []).map(
        (m: {
          id: string;
          role: string;
          content: string;
          citations?: Citation[];
        }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations || undefined,
        }),
      ),
    );
  }

  useEffect(() => {
    loadSessions().catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setLoading(true);
    setError("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message: question }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "问答失败");
      return;
    }
    setSessionId(data.sessionId);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.answer,
        citations: data.citations,
      },
    ]);
    await loadSessions();
  }

  async function newChat() {
    setSessionId(undefined);
    setMessages([]);
    setError("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="card p-3">
        <button className="btn btn-primary mb-3 w-full" onClick={newChat}>
          新对话
        </button>
        <div className="space-y-1">
          {sessions.map((s) => (
            <button
              key={s.id}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                sessionId === s.id
                  ? "bg-[#d9eef5] text-[var(--accent)]"
                  : "hover:bg-[#eef3f8]"
              }`}
              onClick={() => openSession(s.id)}
            >
              {s.title}
            </button>
          ))}
          {sessions.length === 0 ? (
            <p className="px-2 text-xs text-[var(--muted)]">暂无历史会话</p>
          ) : null}
        </div>
      </aside>

      <section className="card flex min-h-[70vh] flex-col p-4">
        <div className="mb-3">
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "var(--font-sora), sans-serif" }}
          >
            Simul8 问答
          </h2>
          <p className="text-sm text-[var(--muted)]">
            答案基于公司知识库检索；生成费用使用你的个人 API。
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-xl bg-[#f8fafc] p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              试试问：如何用 Simul8 建排队系统？或：Routing 和 Label 有什么区别？
            </p>
          ) : null}
          {messages.map((m, idx) => (
            <div
              key={m.id || idx}
              className={`rounded-xl px-3 py-2 ${
                m.role === "user"
                  ? "ml-8 bg-[#d9eef5]"
                  : "mr-8 border border-[var(--line)] bg-white"
              }`}
            >
              <div className="mb-1 text-xs font-semibold text-[var(--muted)]">
                {m.role === "user" ? "你" : "助手"}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-6">
                {m.content}
              </div>
              {m.citations && m.citations.length > 0 ? (
                <div className="mt-2 space-y-1 border-t border-[var(--line)] pt-2">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    引用来源
                  </div>
                  {m.citations.slice(0, 4).map((c, i) => (
                    <div
                      key={`${c.title}-${c.chunkIndex}-${i}`}
                      className="rounded-lg bg-[#f8fafc] p-2 text-xs text-[var(--muted)]"
                    >
                      <div className="font-semibold text-[var(--ink)]">
                        [{i + 1}] {c.title}
                        {c.source ? ` · ${c.source}` : ""}
                      </div>
                      <div className="mt-1 line-clamp-3">{c.excerpt}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {error ? <p className="error mt-3">{error}</p> : null}

        <form onSubmit={onSubmit} className="mt-3 flex gap-2">
          <textarea
            className="textarea flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入关于 Simul8 的问题…"
            rows={2}
          />
          <button className="btn btn-primary self-end" disabled={loading}>
            {loading ? "思考中…" : "发送"}
          </button>
        </form>
      </section>
    </div>
  );
}
