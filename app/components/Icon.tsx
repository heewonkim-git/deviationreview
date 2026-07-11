import React from "react";

/** 얇은 라인 아이콘 (VS Code/Vercel 톤). 1.6 stroke, currentColor. */
export function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  const s = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    style: { display: "block", flex: "0 0 auto" },
  };
  switch (name) {
    case "play":
      return (
        <svg {...s} fill="currentColor" stroke="none" strokeWidth={0}>
          <path d="M8 5.5v13l10.5-6.5z" />
        </svg>
      );
    case "edit":
      return (
        <svg {...s}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case "up":
      return (
        <svg {...s}>
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="6 11 12 5 18 11" />
        </svg>
      );
    case "upload":
      return (
        <svg {...s}>
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          <polyline points="8 8 12 4 16 8" />
          <line x1="12" y1="4" x2="12" y2="15" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...s}>
          <polyline points="9 6 15 12 9 18" />
        </svg>
      );
    case "close":
      return (
        <svg {...s}>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      );
    case "sun":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "moon":
      return (
        <svg {...s}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...s}>
          <rect x="3" y="4" width="18" height="13" rx="1.5" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
  }
}

export type IconName =
  | "play"
  | "edit"
  | "up"
  | "upload"
  | "chevron"
  | "close"
  | "sun"
  | "moon"
  | "monitor";
