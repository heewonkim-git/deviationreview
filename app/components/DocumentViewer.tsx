"use client";

import { parseDeviation } from "@/lib/deviation";
import { AgentOutput, GoldLabels, IssueType, ISSUE_LABELS } from "@/lib/types";

/**
 * 편차 초안을 워드 문서처럼 렌더하고, 이슈 구간을 하이라이트한다.
 *
 * 두 모드:
 *  - review 모드 (gold 없음): 에이전트가 지적한 구간만 하이라이트 (실사용 화면).
 *  - lab 모드 (gold 있음): 정답 대비 TP/FP/FN 을 색으로 구분 (운영 화면 상세보기).
 */

const TYPE_ACCENT: Record<IssueType, string> = {
  missing_5whys: "var(--ds-accent-1)",
  weak_root_cause: "var(--ds-accent-2)",
  missing_capa: "var(--ds-accent-3)",
  unsupported_claims: "var(--ds-accent-4)",
  logical_issues: "var(--ds-info)",
};

type Tone = "flag" | "tp" | "fp" | "fn" | "clean";
const TONE_COLOR: Record<Tone, string> = {
  flag: "var(--ds-accent-1)",
  tp: "var(--ds-success)",
  fp: "var(--ds-danger)",
  fn: "var(--ds-warning)",
  clean: "var(--ds-border-strong)",
};
const TONE_BG: Record<Tone, string> = {
  flag: "var(--ds-accent-1-bg)",
  tp: "var(--ds-success-bg)",
  fp: "var(--ds-danger-bg)",
  fn: "var(--ds-warning-bg)",
  clean: "transparent",
};
const TONE_LABEL: Record<Tone, string> = {
  flag: "에이전트 지적",
  tp: "정탐 (실제 이슈를 잡음)",
  fp: "오탐 (없는 이슈 지적)",
  fn: "놓침 (실제 이슈 누락)",
  clean: "정상",
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

  function toneFor(t: IssueType | null): { tone: Tone; note?: string } | null {
    if (!t) return null;
    const pred = flagged.has(t);
    if (gold) {
      const g = gold[t];
      if (g && pred) return { tone: "tp" };
      if (!g && pred) return { tone: "fp" };
      if (g && !pred) return { tone: "fn" };
      return { tone: "clean" }; // TN — 표시 안 함
    }
    // review 모드
    return pred ? { tone: "flag" } : null;
  }

  return (
    <div className="doc">
      <div className="doc-page">
        {title && <div className="doc-doctype">{title}</div>}
        {sections.map((s) => {
          const info = toneFor(s.issueType);
          const show = info && info.tone !== "clean";
          const tone = info?.tone ?? "clean";
          const issue = s.issueType ? agentByType.get(s.issueType) : undefined;
          return (
            <div
              key={s.key}
              className={`doc-section${show ? " hl" : ""}`}
              style={
                show
                  ? {
                      borderLeftColor: TONE_COLOR[tone],
                      background: TONE_BG[tone],
                    }
                  : undefined
              }
            >
              {s.heading && (
                <div className="doc-h">
                  <span>{s.heading}</span>
                  {show && s.issueType && (
                    <span
                      className="doc-tag"
                      style={{
                        color: TONE_COLOR[tone],
                        background: gold ? "var(--ds-surface)" : TYPE_ACCENT[s.issueType] + "22",
                        borderColor: TONE_COLOR[tone],
                      }}
                    >
                      {ISSUE_LABELS[s.issueType]} · {TONE_LABEL[tone]}
                    </span>
                  )}
                </div>
              )}
              <div className="doc-body">{s.body}</div>
              {show && issue && (
                <div className="doc-note" style={{ color: TONE_COLOR[tone] }}>
                  💬 {issue.explanation}
                </div>
              )}
              {show && !issue && gold && tone === "fn" && s.issueType && (
                <div className="doc-note" style={{ color: TONE_COLOR.fn }}>
                  💬 에이전트가 이 구간의 실제 이슈({ISSUE_LABELS[s.issueType]})를 놓쳤습니다.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
