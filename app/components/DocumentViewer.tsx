"use client";

import { parseDeviation } from "@/lib/deviation";
import { AgentOutput, GoldLabels, IssueType, ISSUE_LABELS } from "@/lib/types";

/**
 * 편차 초안을 문서처럼 렌더하고, 문제 구간을 우측 여백 메모(코멘트)로 표시한다.
 * 카드/채운 배경 없이 본문은 헤어라인만 — 개발 도구스러운 미니멀.
 *
 *  - review 모드 (gold 없음): 에이전트가 지적한 구간만 메모 (실사용).
 *  - lab 모드 (gold 있음): 정답 대비 정탐/오탐/놓침 을 메모로 (운영 상세).
 */

type Tone = "flag" | "tp" | "fp" | "fn";
const TONE_COLOR: Record<Tone, string> = {
  flag: "var(--ds-brand)",
  tp: "var(--ds-success)",
  fp: "var(--ds-danger)",
  fn: "var(--ds-warning)",
};
const TONE_LABEL: Record<Tone, string> = {
  flag: "지적",
  tp: "정탐",
  fp: "오탐",
  fn: "놓침",
};

export interface DocViewerProps {
  draft: string;
  agent: AgentOutput | null;
  gold?: GoldLabels; // 있으면 lab 모드
  title?: string;
}

export function DocumentViewer({ draft, agent, gold, title }: DocViewerProps) {
  const sections = parseDeviation(draft);
  const flagged = new Set(agent?.issues.map((i) => i.type) ?? []);
  const agentByType = new Map(agent?.issues.map((i) => [i.type, i]));

  function noteFor(t: IssueType | null): { tone: Tone; text: string } | null {
    if (!t) return null;
    const pred = flagged.has(t);
    const issue = agentByType.get(t);
    if (gold) {
      const g = gold[t];
      if (g && pred) return { tone: "tp", text: issue?.explanation || "실제 이슈를 정확히 지적." };
      if (!g && pred) return { tone: "fp", text: issue?.explanation || "실제로는 이슈가 아님." };
      if (g && !pred) return { tone: "fn", text: "에이전트가 이 실제 이슈를 놓쳤습니다." };
      return null; // TN
    }
    return pred ? { tone: "flag", text: issue?.explanation || "" } : null;
  }

  return (
    <div className="doc-page">
      {title && <div className="doc-title">{title}</div>}
      <div className="doc-grid">
        {sections.map((s) => {
          const note = noteFor(s.issueType);
          return (
            <div key={s.key} className="doc-row" style={{ display: "contents" }}>
              <div
                className={`doc-body${note ? " hl" : ""}`}
                style={note ? { borderLeftColor: TONE_COLOR[note.tone] } : undefined}
              >
                {s.heading && <div className="doc-h">{s.heading}</div>}
                <div className="doc-text">{s.body}</div>
              </div>
              <div className="note-col">
                {note && s.issueType && (
                  <div className="note" style={{ borderColor: `color-mix(in srgb, ${TONE_COLOR[note.tone]} 45%, var(--ds-border))` }}>
                    <div className="note-h" style={{ color: TONE_COLOR[note.tone] }}>
                      <span className="note-dot" style={{ background: TONE_COLOR[note.tone] }} />
                      {ISSUE_LABELS[s.issueType]}
                      <span className="note-tag">{TONE_LABEL[note.tone]}</span>
                    </div>
                    {note.text && <div className="note-text">{note.text}</div>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
