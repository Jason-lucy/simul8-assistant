"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    inviteCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "注册失败");
      return;
    }
    router.push("/settings");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="card w-full p-6">
        <h1
          className="mb-1 text-2xl font-semibold"
          style={{ fontFamily: "var(--font-sora), sans-serif" }}
        >
          注册账号
        </h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          需要管理员发放的邀请码。注册后请配置你自己的 LLM API。
        </p>
        <form onSubmit={onSubmit}>
          {(
            [
              ["name", "姓名", "text"],
              ["email", "邮箱", "email"],
              ["password", "密码（至少 8 位）", "password"],
              ["inviteCode", "邀请码", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <div className="field" key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                type={type}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required
              />
            </div>
          ))}
          {error ? <p className="error mb-3">{error}</p> : null}
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "注册中…" : "创建账号"}
          </button>
        </form>
        <p className="mt-4 text-sm text-[var(--muted)]">
          已有账号？{" "}
          <Link href="/login" className="text-[var(--accent)] underline">
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
}
