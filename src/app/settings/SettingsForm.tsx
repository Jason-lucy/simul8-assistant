"use client";

import { FormEvent, useEffect, useState } from "react";

type Config = {
  baseUrl: string;
  model: string;
  apiKeyLast4?: string;
} | null;

export function SettingsForm() {
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [model, setModel] = useState("deepseek-chat");
  const [apiKey, setApiKey] = useState("");
  const [config, setConfig] = useState<Config>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setConfig(data.config);
          setBaseUrl(data.config.baseUrl);
          setModel(data.config.model);
        }
      })
      .catch(() => undefined);
  }, []);

  async function save(testOnly = false) {
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/settings/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl,
        model,
        apiKey: apiKey || undefined,
        testOnly,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "操作失败");
      return;
    }
    if (testOnly) {
      setMessage(data.message || "连通测试成功");
    } else {
      setConfig(data.config);
      setApiKey("");
      setMessage("已保存。聊天将使用你自己的 API Key。");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await save(false);
  }

  return (
    <div className="card max-w-2xl p-6">
      <h2
        className="mb-2 text-xl font-semibold"
        style={{ fontFamily: "var(--font-sora), sans-serif" }}
      >
        个人 LLM API 设置
      </h2>
      <p className="mb-5 text-sm text-[var(--muted)]">
        支持 OpenAI 兼容接口（DeepSeek、通义兼容模式、OpenAI 等）。Key
        仅加密保存在服务器，用于你自己的问答调用。
      </p>
      {config?.apiKeyLast4 ? (
        <p className="mb-4 text-sm">
          已配置 Key：****{config.apiKeyLast4} · 模型 {config.model}
        </p>
      ) : (
        <p className="mb-4 text-sm text-[var(--accent-2)]">尚未配置 API Key</p>
      )}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label className="label">API Base URL</label>
          <input
            className="input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
            required
          />
        </div>
        <div className="field">
          <label className="label">模型名</label>
          <input
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek-chat"
            required
          />
        </div>
        <div className="field">
          <label className="label">
            API Key{config ? "（留空表示不修改）" : ""}
          </label>
          <input
            className="input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>
        {error ? <p className="error mb-3">{error}</p> : null}
        {message ? (
          <p className="mb-3 text-sm text-[var(--accent)]">{message}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={loading}>
            保存
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() => save(true)}
          >
            连通测试
          </button>
        </div>
      </form>
    </div>
  );
}
