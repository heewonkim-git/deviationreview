"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

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
    setTheme((t) => (t === "dark" ? "light" : t === "light" ? "system" : "dark"));
  const iconName = theme === "system" ? "monitor" : theme === "light" ? "sun" : "moon";

  const tabs = [
    { href: "/", label: "Operation" },
    { href: "/review", label: "Review" },
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
            <Icon name={iconName} size={14} />
            <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
