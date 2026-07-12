import { DocSection } from "./deviation";

/**
 * 편차 초안 섹션 하나를 "실제 서식"(표·체크박스)처럼 HTML로 렌더한다 (무채색·인라인 스타일).
 * 미리보기는 이 섹션 렌더를 좌측에 두고 우측 여백에 코멘트 말풍선을 붙인다(DocumentViewer).
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const C = {
  line: "#d0d0d0",
  headBg: "#ececec",
  labelBg: "#f5f5f5",
  text: "#1f2328",
  sub: "#5b6470",
};

export function fieldRowsHtml(body: string): string {
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
  return `<table style="width:100%;border-collapse:collapse;margin:0">${rows}</table>`;
}

/** 섹션 하나의 서식 HTML (제목 바 + 표). 개요/표제 블록은 가운데 정렬 타이틀. */
export function sectionFormHtml(sec: DocSection): string {
  if (!sec.heading) {
    const lines = sec.body.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return "";
    const title = `<div style="text-align:center;font-weight:bold;font-size:13pt;color:${C.text};margin-bottom:4px">${esc(lines[0])}</div>`;
    const rest = lines
      .slice(1)
      .map((l) => `<div style="text-align:center;font-size:9pt;color:${C.sub}">${esc(l)}</div>`)
      .join("");
    return `${title}${rest}`;
  }
  const header = `<div style="background:${C.headBg};border:1px solid ${C.line};border-bottom:none;padding:6px 10px;font-weight:bold;font-size:10.5pt;color:${C.text}">${esc(
    sec.heading
  )}</div>`;
  return `${header}${fieldRowsHtml(sec.body)}`;
}
