"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
};

const links = [
  { href: "/chat", label: "问答" },
  { href: "/settings", label: "API 设置" },
  { href: "/admin", label: "知识管理", admin: true },
];

export function AppShell({ user, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <div
              className="text-lg font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-sora), sans-serif" }}
            >
              Simul8 知识助手
            </div>
            <div className="text-xs text-[var(--muted)]">
              公司内知识库 · 每人自备 API
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {links
              .filter((l) => !l.admin || user.role === "ADMIN")
              .map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    pathname.startsWith(l.href)
                      ? "bg-[#d9eef5] text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-[#eef3f8]"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            <button className="btn btn-secondary" onClick={logout}>
              退出
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 text-sm text-[var(--muted)]">
          当前用户：{user.name}（{user.email}）
          {user.role === "ADMIN" ? " · 管理员" : ""}
        </div>
        {children}
      </main>
    </div>
  );
}
