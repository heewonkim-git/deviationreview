"use client";

import { AgentOutput, GoldLabels, IssueType, ISSUE_LABELS, ISSUE_TYPES } from "@/lib/types";
import { deviationFormHtml, FormNotes } from "@/lib/form";

/**
 * 편차 초안을 "실제 서식"(표·체크박스)처럼 렌더하고, 지적된 섹션에 좌측 회색 강조 + 메모를 붙인다.
 * 화면·Word 다운로드가 동일한 폼 빌더(deviationFormHtml)를 쓴다.
 *  - review 모드(gold 없음): 에이전트가 지적한 구간에 "· 지적" 메모
 *  - lab 모드(gold 있음): 정답 대비 정탐/오탐/놓침 메모
 */

export interface DocViewerProps {
  draft: string;
  agent: AgentOutput | null;
  gold?: GoldLabels;
  title?: string;
}

/** 화면·다운로드 공용 — 에이전트/정답으로 섹션 메모 맵을 만든다. */
export function buildNotes(agent: AgentOutput | null, gold?: GoldLabels): FormNotes {
  const flagged = new Set(agent?.issues.map((i) => i.type) ?? []);
  const byType = new Map(agent?.issues.map((i) => [i.type, i]));
  const notes: FormNotes = {};
  for (const t of ISSUE_TYPES as readonly IssueType[]) {
    const pred = flagged.has(t);
    const issue = byType.get(t);
    if (gold) {
      const g = gold[t];
      if (g && pred) notes[t] = { label: `${ISSUE_LABELS[t]} · 정탐`, text: issue?.explanation || "실제 이슈를 정확히 지적." };
      else if (!g && pred) notes[t] = { label: `${ISSUE_LABELS[t]} · 오탐`, text: issue?.explanation || "실제로는 이슈가 아님." };
      else if (g && !pred) notes[t] = { label: `${ISSUE_LABELS[t]} · 놓침`, text: "에이전트가 이 실제 이슈를 놓쳤습니다." };
    } else if (pred) {
      notes[t] = { label: `${ISSUE_LABELS[t]} · 지적`, text: issue?.explanation || "" };
    }
  }
  return notes;
}

export function DocumentViewer({ draft, agent, gold, title }: DocViewerProps) {
  const notes = buildNotes(agent, gold);
  const html = deviationFormHtml(draft, notes);
  return (
    <div className="doc-page">
      {title && <div className="doc-title">{title}</div>}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
