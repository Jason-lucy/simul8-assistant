"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "登录失败");
      return;
    }
    router.push("/chat");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="card w-full p-6">
        <h1
          className="mb-1 text-2xl font-semibold"
          style={{ fontFamily: "var(--font-sora), sans-serif" }}
        >
          Simul8 知识助手
        </h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          使用公司账号登录。模型费用走你自己的 API Key。
        </p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="label">邮箱</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label">密码</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="error mb-3">{error}</p> : null}
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
        <p className="mt-4 text-sm text-[var(--muted)]">
          还没有账号？{" "}
          <Link href="/register" className="text-[var(--accent)] underline">
            用邀请码注册
          </Link>
        </p>
      </div>
    </div>
  );
}
