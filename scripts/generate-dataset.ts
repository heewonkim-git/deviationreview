/**
 * 합성 데이터셋 생성기 (결정적/재현 가능).
 *
 * 100건의 편차(Deviation) 리포트를 생성한다. 각 케이스는 5개 이슈 유형의
 * 존재 여부(gold_labels)를 독립적으로 정하고, 그에 맞는 텍스트 조각을 조립한다.
 * 시드 기반 PRNG를 사용하므로 매번 동일한 데이터셋이 나온다(평가 재현성).
 *
 * 실행:  npm run gen:data
 * 출력:  data/dataset.json
 *
 * 참고: 사용자 선택은 "Claude 생성 + 스키마 검수"였다. 이 스크립트는 API 키 없이도
 * 앱이 동작하도록 하는 결정적 시드 데이터셋을 만든다. Claude로 생성/증강하려면
 * scripts/generate-dataset-claude.ts 를 사용한다(동일 스키마 산출).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DeviationCase, GoldLabels, IssueType, ISSUE_TYPES } from "../lib/types";

// ---- 시드 PRNG (mulberry32) ----
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260712);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

// ---- 시나리오 (도메인 명사 뱅크) ----
interface Scenario {
  event: string;
  param: string;
  equipment: string;
  spec: string;
  observed: string;
  area: string;
  batch: string;
}
const SCENARIOS: Scenario[] = [
  { event: "충전 공정 중 온도 일탈", param: "제품 온도", equipment: "충전기 FL-204", spec: "2–8°C", observed: "12.4°C", area: "무균 충전실", batch: "B-2381" },
  { event: "타정 공정 중 경도 규격 미달", param: "정제 경도", equipment: "타정기 TP-11", spec: "8–12 kp", observed: "5.9 kp", area: "고형제 3라인", batch: "T-4417" },
  { event: "칭량 편차 발생", param: "충전 중량", equipment: "자동칭량기 WS-7", spec: "500±5 mg", observed: "512 mg", area: "칭량실", batch: "W-9902" },
  { event: "세정 밸리데이션 잔류물 초과", param: "잔류 세정제", equipment: "CIP 스킨 C-3", spec: "≤10 ppm", observed: "18 ppm", area: "제조 2호기", batch: "C-1180" },
  { event: "라벨 혼입 의심", param: "라벨 버전", equipment: "라벨러 LB-2", spec: "Rev. C", observed: "Rev. B", area: "포장 1라인", batch: "P-3325" },
  { event: "HVAC 차압 이탈", param: "실간 차압", equipment: "공조기 AHU-5", spec: "10–15 Pa", observed: "6 Pa", area: "Grade C 구역", batch: "H-5561" },
  { event: "정제수 전도도 상승", param: "전도도", equipment: "정제수 시스템 PW-1", spec: "≤1.3 µS/cm", observed: "2.1 µS/cm", area: "유틸리티", batch: "U-7740" },
  { event: "무균 시험 중 오염 의심", param: "환경 모니터링 CFU", spec: "≤1 CFU", equipment: "아이솔레이터 IS-2", observed: "4 CFU", area: "QC 미생물", batch: "S-6604" },
  { event: "배치 기록서 기재 누락", param: "공정 기록", equipment: "MES 단말 M-12", spec: "전 항목 기재", observed: "3개 항목 공란", area: "제조 1호기", batch: "R-8890" },
  { event: "정전으로 인한 공정 중단", param: "동결건조 온도", equipment: "동결건조기 LY-3", spec: "-40°C 유지", observed: "-22°C 상승", area: "동결건조실", batch: "L-2213" },
];

// ---- 이슈 유형별 텍스트 조각 (good = 결함 없음, bad = 결함 있음) ----
function fivewhys(s: Scenario, bad: boolean): string {
  if (!bad) {
    return `[근본원인 분석 - 5 Whys]
1) 왜 ${s.param}이(가) 규격(${s.spec})을 벗어났는가? → ${s.equipment}의 제어값이 이탈했다.
2) 왜 제어값이 이탈했는가? → 센서 피드백이 지연되었다.
3) 왜 피드백이 지연되었는가? → 센서 교정 주기가 초과되었다.
4) 왜 교정 주기가 초과되었는가? → 예방정비(PM) 일정에 해당 센서가 누락되어 있었다.
5) 왜 PM 일정에서 누락되었는가? → PM 마스터 리스트 갱신 절차에 검토 단계가 없었다.`;
  }
  return `[근본원인 분석]
${s.param}이(가) 규격(${s.spec})을 벗어난 것으로 보인다. 작업자가 설비를 확인하였으나 명확한 원인은 파악되지 않았다. (※ Why 분석 미완결)`;
}

function rootcause(s: Scenario, bad: boolean): string {
  if (!bad) {
    return `[근본 원인]
PM 마스터 리스트 갱신 절차에 독립 검토 단계가 부재하여 ${s.equipment} 센서가 교정 대상에서 누락된 것이 근본 원인이다(프로세스 결함).`;
  }
  return `[근본 원인]
작업자의 부주의로 판단된다.`;
}

function claims(s: Scenario, bad: boolean): string {
  if (!bad) {
    return `[영향 평가]
당해 배치(${s.batch})에 대한 재시험 결과 및 인접 배치 3건의 데이터를 검토한 결과 품질 영향 없음을 확인하였다(첨부 Data-${s.batch}).`;
  }
  return `[영향 평가]
품질에 미치는 영향은 없는 것으로 확인되었다.`; // 근거 미제시
}

function capa(s: Scenario, bad: boolean): string {
  if (!bad) {
    return `[CAPA]
- 시정조치(Corrective): ${s.equipment} 센서 즉시 재교정 및 당해 배치 격리.
- 예방조치(Preventive): PM 마스터 리스트 갱신 절차(SOP-PM-002)에 독립 검토 단계 추가.`;
  }
  return `[CAPA]
- 시정조치(Corrective): ${s.equipment}를 재가동하였다.`; // 예방조치 누락
}

/** 논리적 비일관성: 결론이 근거와 모순되도록 결론 문장을 바꾼다. */
function conclusion(s: Scenario, logicalBad: boolean, claimsBad: boolean): string {
  if (logicalBad) {
    // 근거는 규격 이탈/영향 가능성을 시사하는데 결론은 "영향 없음, 조치 불필요"로 모순.
    return `[결론]
${s.observed} 측정으로 규격(${s.spec})을 벗어났으나, 별도 조사나 조치는 불필요하며 배치를 그대로 출하한다.`;
  }
  return `[결론]
규격 이탈이 확인되어 상기 CAPA를 이행하고 CAPA 완료 후 배치 처리를 결정한다.`;
}

function buildDraft(s: Scenario, g: GoldLabels, id: string): string {
  const header = `편차 리포트 ${id}
구역: ${s.area} | 설비: ${s.equipment} | 배치: ${s.batch}
[사건 개요]
${s.event}. ${s.param} 측정값 ${s.observed} (규격 ${s.spec}).`;

  const parts = [
    header,
    fivewhys(s, g.missing_5whys),
    rootcause(s, g.weak_root_cause),
    claims(s, g.unsupported_claims),
    capa(s, g.missing_capa),
    conclusion(s, g.logical_issues, g.unsupported_claims),
  ];
  return parts.join("\n\n");
}

function expectedIssues(s: Scenario, g: GoldLabels) {
  const details: Record<IssueType, string> = {
    missing_5whys: "5 Whys 분석이 미완결 상태",
    weak_root_cause: "근본 원인이 '부주의' 등 증상 수준에 머무름",
    missing_capa: "예방조치(Preventive)가 누락됨",
    unsupported_claims: "'영향 없음' 결론에 뒷받침 데이터가 없음",
    logical_issues: "규격 이탈 근거와 '조치 불필요' 결론이 모순",
  };
  return ISSUE_TYPES.filter((t) => g[t]).map((t) => ({ type: t, detail: details[t] }));
}

// ---- 라벨 벡터 생성: 유형별 ~50% 균형 + 난이도 ----
function makeLabels(): GoldLabels {
  const g = {} as GoldLabels;
  for (const t of ISSUE_TYPES) g[t] = rand() < 0.5;
  return g;
}

function difficulty(g: GoldLabels): DeviationCase["difficulty"] {
  const n = ISSUE_TYPES.filter((t) => g[t]).length;
  if (n <= 1) return "easy";
  if (n <= 3) return "medium";
  return "hard";
}

function main() {
  const cases: DeviationCase[] = [];
  for (let i = 0; i < 100; i++) {
    const id = `DEV-${String(i + 1).padStart(4, "0")}`;
    const scenario = { ...SCENARIOS[i % SCENARIOS.length], batch: pick(SCENARIOS).batch + `-${i + 1}` };
    // 앞쪽 몇 건은 극단 케이스(전부 결함 없음 / 전부 결함)로 넣어 커버리지 확보.
    let g: GoldLabels;
    if (i === 0) g = Object.fromEntries(ISSUE_TYPES.map((t) => [t, false])) as GoldLabels;
    else if (i === 1) g = Object.fromEntries(ISSUE_TYPES.map((t) => [t, true])) as GoldLabels;
    else g = makeLabels();

    cases.push({
      id,
      difficulty: difficulty(g),
      draft: buildDraft(scenario, g, id),
      gold_labels: g,
      expected_issues: expectedIssues(scenario, g),
    });
  }

  const outDir = join(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "dataset.json"), JSON.stringify(cases, null, 2), "utf8");

  // 분포 리포트
  const dist = Object.fromEntries(ISSUE_TYPES.map((t) => [t, cases.filter((c) => c.gold_labels[t]).length]));
  console.log(`생성 완료: ${cases.length}건 → data/dataset.json`);
  console.log("유형별 결함 포함 건수:", dist);
  const diff = { easy: 0, medium: 0, hard: 0 };
  cases.forEach((c) => diff[c.difficulty]++);
  console.log("난이도 분포:", diff);
}

main();
