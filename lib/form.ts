import { parseDeviation } from "./deviation";
import { IssueType } from "./types";

/**
 * 편차 초안(텍스트)을 "실제 서식"처럼 표·체크박스가 있는 HTML로 렌더한다.
 * 화면(dangerouslySetInnerHTML)과 Word 다운로드가 동일한 결과를 쓰도록 인라인 스타일 사용
 * (문서는 무채색 흰 종이 고정). 지적된 섹션은 좌측 회색 강조 + 하단 메모.
 */

export type FormNotes = Partial<Record<IssueType, { label: string; text: string }>>;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 회색 팔레트 (무채색)
const C = {
  line: "#d0d0d0",
  headBg: "#ececec",
  labelBg: "#f5f5f5",
  text: "#1f2328",
  sub: "#5b6470",
  accent: "#8a8f98",
  noteBg: "#f6f6f6",
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

export function deviationFormHtml(draft: string, notes: FormNotes = {}): string {
  const sections = parseDeviation(draft);
  const parts = sections.map((sec) => {
    // 표제/개요 앞 블록
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
    const note = sec.issueType ? notes[sec.issueType] : undefined;
    const header = `<div style="background:${C.headBg};border:1px solid ${C.line};border-bottom:none;padding:6px 10px;font-weight:bold;font-size:10.5pt;color:${C.text}">${esc(
      sec.heading
    )}</div>`;
    const table = fieldRows(sec.body);
    const noteBox = note
      ? `<div style="background:${C.noteBg};border:1px dashed ${C.accent};padding:7px 11px;font-size:9pt;color:${C.sub};margin:2px 0 10px">■ ${esc(
          note.label
        )}<br/><span style="color:${C.text}">${esc(note.text)}</span></div>`
      : "";
    const block = `${header}${table}`;
    if (note) {
      return `<div style="border-left:3px solid ${C.accent};padding-left:8px;margin:12px 0 2px">${block}</div>${noteBox}`;
    }
    return `<div style="margin:12px 0 2px">${block}</div>`;
  });
  return parts.join("");
}
