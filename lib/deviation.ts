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
  if (/5\s*Whys/i.test(h) || /근본원인\s*분석/.test(h)) return "missing_5whys";
  if (/^근본\s*원인$/.test(h)) return "weak_root_cause";
  if (/영향\s*평가/.test(h)) return "unsupported_claims";
  if (/CAPA/i.test(h)) return "missing_capa";
  if (/결론/.test(h)) return "logical_issues";
  return null; // 사건 개요 등
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

  for (const line of lines) {
    const m = line.match(/^\s*\[(.+?)\]\s*$/);
    if (m) {
      flush();
      const heading = m[1].trim();
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
