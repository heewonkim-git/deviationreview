"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** 상단 내비 — 운영(평가 랩)과 실사용(리뷰어) 두 화면을 분리해 오간다. */
export function Nav() {
  const path = usePathname();
  const [theme, setTheme] = useState<"system" | "light" | "dark">("dark");

  useEffect(() => {
    const el = document.documentElement;
    if (theme === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", theme);
  }, [theme]);

  const cycle = () =>
    setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  const icon = theme === "system" ? "◐" : theme === "light" ? "☀" : "☾";

  const tabs = [
    { href: "/", label: "평가 랩 · 운영" },
    { href: "/review", label: "리뷰어 · 실사용" },
  ];

  return (
    <nav className="nav">
      <div className="nav-in">
        <span className="nav-brand">
          <b>Deviation Review Platform</b>
        </span>
        <div className="nav-tabs">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`nav-tab ${path === t.href ? "active" : ""}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <div className="nav-right">
          <button className="toggle" onClick={cycle} aria-label="테마 전환">
            <span>{icon}</span>
            <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
