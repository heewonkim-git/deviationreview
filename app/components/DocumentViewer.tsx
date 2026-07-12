"use client";

import { AgentOutput, GoldLabels, IssueType, ISSUE_LABELS, ISSUE_TYPES } from "@/lib/types";
import { parseDeviation } from "@/lib/deviation";
import { sectionFormHtml } from "@/lib/form";

/**
 * 편차 초안을 "실제 서식"(표·체크박스)으로 렌더하고, 지적된 섹션에는 우측 여백에
 * Word 검토 코멘트 같은 말풍선을 붙인다.
 *  - review 모드(gold 없음): 에이전트가 지적한 구간에 코멘트
 *  - lab 모드(gold 있음): 정답 대비 정탐/오탐/놓침 코멘트
 */

export type Note = { label: string; text: string };
export type NotesMap = Partial<Record<IssueType, Note>>;

export interface DocViewerProps {
  draft: string;
  agent: AgentOutput | null;
  gold?: GoldLabels;
  title?: string;
}

export function buildNotes(agent: AgentOutput | null, gold?: GoldLabels): NotesMap {
  const flagged = new Set(agent?.issues.map((i) => i.type) ?? []);
  const byType = new Map(agent?.issues.map((i) => [i.type, i]));
  const notes: NotesMap = {};
  for (const t of ISSUE_TYPES as readonly IssueType[]) {
    const pred = flagged.has(t);
    const issue = byType.get(t);
    if (gold) {
      const g = gold[t];
      if (g && pred) notes[t] = { label: `${ISSUE_LABELS[t]} · 정탐`, text: issue?.explanation || "실제 이슈를 정확히 지적." };
      else if (!g && pred) notes[t] = { label: `${ISSUE_LABELS[t]} · 오탐`, text: issue?.explanation || "실제로는 이슈가 아님." };
      else if (g && !pred) notes[t] = { label: `${ISSUE_LABELS[t]} · 놓침`, text: "에이전트가 이 실제 이슈를 놓쳤습니다." };
    } else if (pred) {
      notes[t] = { label: ISSUE_LABELS[t], text: issue?.explanation || "" };
    }
  }
  return notes;
}

export const COMMENT_AUTHOR = "자동화 검토 결과 (DRP AI Agent)";

export function DocumentViewer({ draft, agent, gold, title }: DocViewerProps) {
  const notes = buildNotes(agent, gold);
  const sections = parseDeviation(draft);
  return (
    <div className="doc-page">
      {title && <div className="doc-title">{title}</div>}
      {sections.map((sec) => {
        const note = sec.issueType ? notes[sec.issueType] : undefined;
        return (
          <div className="doc-secrow" key={sec.key}>
            <div
              className={`doc-sec${note ? " hl" : ""}`}
              dangerouslySetInnerHTML={{ __html: sectionFormHtml(sec) }}
            />
            <div className="doc-margin">
              {note && (
                <div className="cmt">
                  <div className="cmt-h">{COMMENT_AUTHOR}</div>
                  <div className="cmt-b">
                    <b>{note.label}</b>
                    {note.text ? <div className="cmt-t">{note.text}</div> : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
