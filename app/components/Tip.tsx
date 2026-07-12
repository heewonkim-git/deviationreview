import React from "react";

/** 조용히 뜨는 설명 툴팁 — 설명(여러 줄) + 선택적 수식(민트). 공용. */
export function Tip({ label, desc, formula }: { label: React.ReactNode; desc: string; formula?: string }) {
  return (
    <span className="tt">
      {label}
      <span className="tt-box" role="tooltip">
        <span className="tt-desc">{desc}</span>
        {formula && <span className="tt-formula">{formula}</span>}
      </span>
    </span>
  );
}
