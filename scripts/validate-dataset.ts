/**
 * 데이터셋 스키마·라벨 정합성 검수.
 * 실행: npm run check:data
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DeviationCase, ISSUE_TYPES } from "../lib/types";

function main() {
  const path = join(process.cwd(), "data", "dataset.json");
  const cases = JSON.parse(readFileSync(path, "utf8")) as DeviationCase[];
  const errors: string[] = [];

  if (cases.length !== 100) errors.push(`케이스 수가 100이 아님: ${cases.length}`);

  const ids = new Set<string>();
  for (const c of cases) {
    if (ids.has(c.id)) errors.push(`중복 id: ${c.id}`);
    ids.add(c.id);
    if (!c.draft || c.draft.length < 40) errors.push(`${c.id}: draft 너무 짧음`);
    if (!["easy", "medium", "hard"].includes(c.difficulty))
      errors.push(`${c.id}: difficulty 유효하지 않음`);

    // gold_labels: 정확히 5개 유형, boolean
    for (const t of ISSUE_TYPES) {
      if (typeof c.gold_labels?.[t] !== "boolean")
        errors.push(`${c.id}: gold_labels.${t} 누락/타입 오류`);
    }
    const extraKeys = Object.keys(c.gold_labels || {}).filter(
      (k) => !ISSUE_TYPES.includes(k as never)
    );
    if (extraKeys.length) errors.push(`${c.id}: 알 수 없는 라벨 키 ${extraKeys.join(",")}`);

    // expected_issues ↔ gold_labels 정합성
    const expectedTypes = new Set(c.expected_issues.map((e) => e.type));
    for (const t of ISSUE_TYPES) {
      if (c.gold_labels[t] && !expectedTypes.has(t))
        errors.push(`${c.id}: gold=${t}=true 이나 expected_issues에 없음`);
      if (!c.gold_labels[t] && expectedTypes.has(t))
        errors.push(`${c.id}: gold=${t}=false 이나 expected_issues에 있음`);
    }
  }

  // 분포 검수: 각 유형이 20~80% 범위 안에 있어야 편향이 아님
  for (const t of ISSUE_TYPES) {
    const n = cases.filter((c) => c.gold_labels[t]).length;
    if (n < 20 || n > 80) errors.push(`분포 편향: ${t} = ${n}/100`);
  }

  if (errors.length) {
    console.error(`검수 실패 (${errors.length}건):`);
    errors.slice(0, 30).forEach((e) => console.error("  -", e));
    process.exit(1);
  }
  console.log(`검수 통과: ${cases.length}건, 스키마·라벨·분포 정합성 OK`);
}

main();
