import { parseDeviation } from "./deviation";
import { IssueType, ISSUE_TYPES } from "./types";

/**
 * 편차 초안(텍스트)을 "실제 서식"(표·체크박스)처럼 렌더한다.
 * 리뷰 결과는 문서 맨 위 "AI 리뷰 메모" 콜아웃(판정 + 수정필요 1·2·3)으로 분리 표시하고,
 * 본문의 해당 섹션은 회색 왼쪽 바로 위치만 강조한다 (본문과 메모가 섞이지 않도록).
 * 화면(dangerouslySetInnerHTML)과 Word 다운로드가 동일 결과를 쓰도록 인라인 스타일·무채색.
 */

export type FormNotes = Partial<Record<IssueType, { label: string; text: string }>>;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const C = {
  line: "#d0d0d0",
  headBg: "#ececec",
  labelBg: "#f5f5f5",
  text: "#1f2328",
  sub: "#5b6470",
  accent: "#8a8f98",
  memoBar: "#4b5563",
  memoBg: "#f3f4f6",
};

function fieldRows(body: string): string {
  const rows = body
    .split("\n")
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
      if (!parts.length) return "";
      return parts
        .map((part) => {
          const m = part.match(/^(.+?):\s*(.*)$/);
          if (m && m[2] !== "") {
            return `<tr><td style="background:${C.labelBg};border:1px solid ${C.line};padding:5px 9px;width:30%;font-size:9.5pt;color:${C.sub};vertical-align:top;white-space:nowrap">${esc(
              m[1]
            )}</td><td style="border:1px solid ${C.line};padding:5px 9px;font-size:9.5pt;color:${C.text};vertical-align:top;white-space:pre-wrap">${esc(m[2])}</td></tr>`;
          }
          return `<tr><td colspan="2" style="border:1px solid ${C.line};padding:5px 9px;font-size:9.5pt;color:${C.text};white-space:pre-wrap">${esc(
            part
          )}</td></tr>`;
        })
        .join("");
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 4px">${rows}</table>`;
}

/** 문서 맨 위 리뷰 메모 콜아웃. */
function reviewMemo(notes: FormNotes, verdict?: string): string {
  const entries = ISSUE_TYPES.map((t) => notes[t]).filter(Boolean) as { label: string; text: string }[];
  if (!entries.length && !verdict) return "";
  const items = entries.length
    ? entries
        .map(
          (n, i) =>
            `<div style="margin:5px 0"><b style="color:${C.text}">${i + 1}. ${esc(n.label)}</b><br/><span style="color:${C.sub}">${esc(
              n.text
            )}</span></div>`
        )
        .join("")
    : `<div style="color:${C.sub}">지적된 이슈 없음</div>`;
  const verdictLine = verdict
    ? `<div style="margin-bottom:8px;color:${C.text}"><b>판정:</b> ${esc(verdict)}</div>`
    : "";
  return `<div style="border:1px solid ${C.accent};border-left:4px solid ${C.memoBar};background:${C.memoBg};border-radius:6px;padding:12px 15px;margin-bottom:20px">
    <div style="font-weight:bold;font-size:10.5pt;color:${C.text};margin-bottom:8px">📝 AI 리뷰 메모 — 수정이 필요한 항목</div>
    ${verdictLine}${items}
  </div>`;
}

export function deviationFormHtml(draft: string, notes: FormNotes = {}, verdict?: string): string {
  const memo = reviewMemo(notes, verdict);
  const sections = parseDeviation(draft).map((sec) => {
    if (!sec.heading) {
      const lines = sec.body.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return "";
      const title = `<div style="text-align:center;font-weight:bold;font-size:13pt;color:${C.text};margin-bottom:4px">${esc(lines[0])}</div>`;
      const rest = lines
        .slice(1)
        .map((l) => `<div style="text-align:center;font-size:9pt;color:${C.sub}">${esc(l)}</div>`)
        .join("");
      return `<div style="margin-bottom:12px">${title}${rest}</div>`;
    }
    const flagged = sec.issueType ? notes[sec.issueType] : undefined;
    const header = `<div style="background:${C.headBg};border:1px solid ${C.line};border-bottom:none;padding:6px 10px;font-weight:bold;font-size:10.5pt;color:${C.text}">${esc(
      sec.heading
    )}${flagged ? `<span style="float:right;font-weight:normal;font-size:9pt;color:${C.memoBar}">● 리뷰 메모 참조</span>` : ""}</div>`;
    const block = header + fieldRows(sec.body);
    // 지적된 섹션: 회색 왼쪽 바로 위치만 강조 (설명은 상단 메모에)
    if (flagged) {
      return `<div style="border-left:4px solid ${C.memoBar};padding-left:9px;margin:14px 0 2px">${block}</div>`;
    }
    return `<div style="margin:14px 0 2px">${block}</div>`;
  });
  return memo + sections.join("");
}
