import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "./components/Nav";

export const metadata: Metadata = {
  title: "Deviation Review Agent · Evaluation Lab",
  description:
    "LLM 시스템을 배포 전 어떻게 검증하는지 보여주는 교육용 랩 — 프롬프트를 믿지 말고 평가를 믿어라.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="dark">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
