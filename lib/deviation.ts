import { IssueType } from "./types";

/**
 * 편차 초안을 "문서 섹션"으로 파싱한다 (워드 뷰어 + 하이라이트용).
 * 초안은 `[섹션명]` 헤더로 구분되며, 각 섹션을 이슈 유형에 매핑한다.
 */
export interface DocSection {
  key: string;
  heading: string | null; // null = 표제/메타 블록
  body: string;
  issueType: IssueType | null; // 이 섹션이 검토하는 이슈 유형
}

function classify(heading: string): IssueType | null {
  const h = heading.trim();
  // 근본 원인 결론(도출된 원인의 강도) — RCA 방법 섹션보다 먼저 검사.
  if (/근본\s*원인\s*결론/.test(h) || /Root Cause Conclusion/i.test(h)) return "weak_root_cause";
  // RCA 방법 섹션 (5 Whys / Fishbone 공통).
  if (/근본\s*원인\s*분석/.test(h) || /Root Cause Analysis/i.test(h) || /5\s*Whys/i.test(h) || /Fishbone/i.test(h))
    return "missing_rca";
  if (/영향\s*평가/.test(h)) return "unsupported_claims";
  if (/CAPA/i.test(h)) return "missing_capa";
  if (/결론|종합\s*판정|승인/.test(h)) return "logical_issues";
  return null; // 개요·분류·상세·조치·조사 등
}

export function parseDeviation(draft: string): DocSection[] {
  const lines = draft.split("\n");
  const sections: DocSection[] = [];
  let cur: DocSection | null = null;
  let intro: string[] = [];

  const flush = () => {
    if (cur) {
      cur.body = cur.body.replace(/\s+$/g, "");
      sections.push(cur);
      cur = null;
    }
  };

  // 섹션 헤더 인식: (1) [대괄호] (우리 생성 데이터), (2) "5. 영향 평가 ..." 숫자형(실제 서식),
  // (3) "근본 원인 결론 ..." (RCA 결론 소섹션).
  function headingOf(line: string): string | null {
    const braced = line.match(/^\s*\[(.+?)\]\s*$/);
    if (braced) return braced[1].trim();
    const numbered = line.match(/^\s*(\d{1,2})[.)]\s+(\S.{1,50})$/);
    if (numbered) return line.trim();
    // '근본 원인 결론' 헤더는 순수 제목일 때만 (본문의 'label: value' 라인은 제외).
    if (/^\s*근본\s*원인\s*결론/.test(line) && !/:\s*\S/.test(line)) return line.trim();
    return null;
  }

  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) {
      flush();
      cur = {
        key: `s${sections.length}`,
        heading,
        body: "",
        issueType: classify(heading),
      };
    } else if (cur) {
      cur.body += (cur.body ? "\n" : "") + line;
    } else {
      intro.push(line);
    }
  }
  flush();

  if (intro.join("").trim()) {
    sections.unshift({
      key: "intro",
      heading: null,
      body: intro.join("\n").trim(),
      issueType: null,
    });
  }
  return sections;
}
