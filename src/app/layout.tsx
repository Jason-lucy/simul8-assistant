import type { Metadata } from "next";
import { Source_Sans_3, Sora } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Simul8 知识问答助手",
  description: "公司内部 Simul8 知识库问答，每人配置自己的 LLM API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${sourceSans.variable} ${sora.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
