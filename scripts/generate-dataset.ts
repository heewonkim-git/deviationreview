/**
 * 합성 데이터셋 생성기 (결정적/재현 가능) — GMP Deviation/CAPA Record 템플릿 기반.
 *
 * 실제 표준 편차보고서 서식(§1 개요 ~ §8 CAPA, §7 RCA는 5 Whys 또는 Fishbone 선택)을 따르며,
 * 5개 이슈 유형의 결함을 독립적으로 주입한다. RCA는 방법(5 Whys/Fishbone)과 무관하게
 * "분석 완결성" 기준으로 판정한다(missing_rca).
 *
 * 실행:  npm run gen:data → data/dataset.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DeviationCase, GoldLabels, IssueType, ISSUE_TYPES } from "../lib/types";

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

interface Scenario {
  event: string;
  param: string;
  equipment: string;
  eqNo: string;
  spec: string;
  observed: string;
  area: string;
  step: string;
  product: string;
  sop: string;
}
const SCENARIOS: Scenario[] = [
  { event: "충전 공정 중 온도 일탈", param: "제품 온도", equipment: "충전기", eqNo: "FL-204", spec: "2–8 °C", observed: "12.4 °C", area: "무균 충전실", step: "Fill-Finish", product: "MAB-201 주사제", sop: "SOP-FF-014" },
  { event: "타정 공정 중 경도 규격 미달", param: "정제 경도", equipment: "타정기", eqNo: "TP-11", spec: "8–12 kp", observed: "5.9 kp", area: "고형제 3라인", step: "Compression", product: "TAB-330 정제", sop: "SOP-SL-022" },
  { event: "칭량 편차 발생", param: "충전 중량", equipment: "자동칭량기", eqNo: "WS-7", spec: "500 ± 5 mg", observed: "512 mg", area: "칭량실", step: "Dispensing", product: "CAP-118 캡슐", sop: "SOP-DS-006" },
  { event: "세정 밸리데이션 잔류물 초과", param: "잔류 세정제", equipment: "CIP 스킨", eqNo: "C-3", spec: "≤ 10 ppm", observed: "18 ppm", area: "제조 2호기", step: "Cleaning", product: "공용 설비", sop: "SOP-CL-009" },
  { event: "HVAC 실간 차압 이탈", param: "실간 차압", equipment: "공조기", eqNo: "AHU-5", spec: "10–15 Pa", observed: "6 Pa", area: "Grade C 구역", step: "Environmental", product: "무균 원료", sop: "SOP-EN-003" },
  { event: "정제수 전도도 상승", param: "전도도", equipment: "정제수 시스템", eqNo: "PW-1", spec: "≤ 1.3 µS/cm", observed: "2.1 µS/cm", area: "유틸리티", step: "Utility", product: "정제수", sop: "SOP-UT-011" },
  { event: "무균 시험 중 환경 오염 의심", param: "환경 모니터링 CFU", equipment: "아이솔레이터", eqNo: "IS-2", spec: "≤ 1 CFU", observed: "4 CFU", area: "QC 미생물", step: "Purification", product: "MAB-201 원액", sop: "SOP-QC-018" },
  { event: "정전으로 인한 동결건조 온도 상승", param: "동결건조 온도", equipment: "동결건조기", eqNo: "LY-3", spec: "-40 °C 유지", observed: "-22 °C", area: "동결건조실", step: "Fill-Finish", product: "LYO-402 동결건조제", sop: "SOP-FF-021" },
];

function pad(n: number) {
  return String(n).padStart(4, "0");
}

// ---- §7 RCA: 5 Whys ----
function fivewhys(s: Scenario, bad: boolean): string {
  if (bad) {
    return `분석 도구 선택: ☒ 5 Whys   ☐ Fishbone
문제 정의: ${s.param}이(가) 규격(${s.spec})을 벗어남.
Why 1: ${s.equipment} ${s.eqNo}의 제어값이 이탈함.
Why 2: (기입되지 않음)
(※ 근본원인 분석 미완결 — Why 사슬이 근본 원인에 도달하기 전에 중단됨)`;
  }
  return `분석 도구 선택: ☒ 5 Whys   ☐ Fishbone
문제 정의: ${s.param}이(가) 규격(${s.spec})을 벗어남.
Why 1: ${s.equipment} ${s.eqNo}의 제어값이 이탈함.
Why 2: 센서 피드백이 지연됨.
Why 3: 센서 교정 주기가 초과됨.
Why 4: 예방정비(PM) 일정에서 해당 센서가 누락됨.
Why 5: PM 마스터 리스트 갱신 절차에 독립 검토 단계가 부재함.`;
}

// ---- §7 RCA: Fishbone (6M) ----
function fishbone(s: Scenario, bad: boolean): string {
  if (bad) {
    return `분석 도구 선택: ☐ 5 Whys   ☒ Fishbone (특성요인도, 6M)
특성/문제(Effect): ${s.param} 규격 이탈.
Man: -
Machine: ${s.equipment} ${s.eqNo} 이상 가능성
Method: -
Material: -
Measurement: -
Environment: -
(※ 근본원인 분석 미완결 — 6M 대부분 범주가 미도출)`;
  }
  return `분석 도구 선택: ☐ 5 Whys   ☒ Fishbone (특성요인도, 6M)
특성/문제(Effect): ${s.param} 규격(${s.spec}) 이탈.
Man: 교정 담당자의 PM 항목 인지 부족.
Machine: ${s.equipment} ${s.eqNo} 센서 노후.
Method: PM 마스터 리스트 갱신 절차에 검토 단계 부재.
Material: 해당 없음(원부자재 무관 확인).
Measurement: 센서 교정 주기 관리 미흡.
Environment: 해당 없음.`;
}

function rcaConclusion(s: Scenario, weakBad: boolean): string {
  if (weakBad) return `근본 원인 결론: 작업자의 부주의로 판단된다.`;
  return `근본 원인 결론(프로세스/시스템 수준): PM 마스터 리스트 갱신 절차에 독립 검토 단계가 부재하여 ${s.equipment} ${s.eqNo} 센서가 교정 대상에서 누락된 것이 근본 원인이다.`;
}

function impact(s: Scenario, unsupportedBad: boolean): string {
  if (unsupportedBad) {
    return `제품 품질(CQA): ☐무 ☒유
공정: ☐무 ☒유
인접·후속 배치: ☒무 ☐유
밸리데이션 상태: ☒무 ☐유
종합 영향 결론: 품질에 미치는 영향은 없는 것으로 판단된다.`;
  }
  return `제품 품질(CQA): ☐무 ☒유 — 재시험 결과 규격 내 확인(첨부 Data-${s.eqNo})
공정: ☐무 ☒유 — 공정 파라미터 트렌드 검토(첨부 Trend-${s.eqNo})
인접·후속 배치: ☒무 ☐유 — 인접 배치 3건 데이터 검토, 이상 없음
밸리데이션 상태: ☒무 ☐유 — 적격성 재확인 완료
종합 영향 결론: 상기 데이터 검토 결과 당해 및 인접 배치의 품질 영향 없음을 확인함.`;
}

function capa(s: Scenario, missingBad: boolean): string {
  if (missingBad) {
    return `① 시정조치(Corrective): ${s.equipment} ${s.eqNo} 센서 즉시 재교정 및 당해 배치 격리. (담당: 생산기술 / 완료예정 즉시)`;
  }
  return `① 시정조치(Corrective): ${s.equipment} ${s.eqNo} 센서 즉시 재교정 및 당해 배치 격리. (담당: 생산기술 / 완료예정 즉시)
② 예방조치(Preventive): PM 마스터 리스트 갱신 절차(${s.sop})에 독립 검토 단계를 추가하고 전 설비로 수평전개. (담당: QA / 완료예정 30일)`;
}

function conclusion(s: Scenario, logicalBad: boolean): string {
  if (logicalBad) {
    return `종합 판정 및 승인: ${s.observed} 측정으로 규격(${s.spec})을 벗어났으나, 별도 조치 없이 배치를 출하한다. (QA 승인 __)`;
  }
  return `종합 판정 및 승인: 규격 이탈이 확인되어 상기 CAPA를 이행하고, CAPA 완료 및 영향평가 결과에 따라 배치 처리를 결정한다. (QA 검토 __ / 승인 __)`;
}

function buildDraft(s: Scenario, g: GoldLabels, id: string, useFishbone: boolean): string {
  const dv = `DV-2026-${id.slice(-4)}`;
  const rca = useFishbone ? fishbone(s, g.missing_rca) : fivewhys(s, g.missing_rca);
  return `편차 보고서 (Deviation Report) — QA-DEV-F-001 Rev.00 · ${id}

[1. 편차 개요]
편차번호: ${dv} | 발생일시: 2026-06-12 09:20 | 발견일시: 2026-06-12 10:05
작성자/부서: 홍길동 / 생산1팀
제품: ${s.product} | 배치번호: LOT-${id.slice(-4)} | 공정 단계: ${s.step} | 발생 위치: ${s.area}
관련 설비: ${s.equipment} ${s.eqNo} | 관련 문서: ${s.sop}

[2. 편차 분류]
등급: ☐Minor ☒Major ☐Critical | 유형: ☒공정(Process) ☐설비 ☐문서 | 비계획 편차(Unplanned)

[3. 편차 상세 기술]
항목: ${s.param} | 규격/기준값: ${s.spec} | 실측값: ${s.observed}
발생 경위: ${s.event}. 상기 공정 진행 중 ${s.param} 측정값이 ${s.observed}로 규격을 벗어난 것을 확인함.

[4. 즉각 조치]
☒배치/제품 격리 ☒공정 중단 ☐설비 사용중지. 조치자: 생산1팀 / 조치일시: 발견 즉시.

[5. 영향 평가]
${impact(s, g.unsupported_claims)}

[6. 조사]
조사 범위: 당해 배치 및 인접 배치. 조사 방법: ☒기록 검토 ☒현장 확인 ☒데이터 분석.
검토 기록: Batch Record / 교정기록 / 로그북. 조사 결과 요약: ${s.equipment} ${s.eqNo} 제어 이력에서 이탈 시점 확인.

[7. 근본 원인 분석 (Root Cause Analysis)]
${rca}

[근본 원인 결론]
${rcaConclusion(s, g.weak_root_cause)}

[8. CAPA]
${capa(s, g.missing_capa)}

[결론 및 승인]
${conclusion(s, g.logical_issues)}`;
}

function expectedIssues(g: GoldLabels) {
  const details: Record<IssueType, string> = {
    missing_rca: "§7 근본원인 분석(선택 방법)이 미완결",
    weak_root_cause: "근본 원인 결론이 '부주의' 등 증상 수준에 머무름",
    missing_capa: "예방조치(Preventive)가 누락됨",
    unsupported_claims: "'영향 없음' 결론에 뒷받침 데이터가 없음",
    logical_issues: "규격 이탈 근거와 '조치 없이 출하' 결론이 모순",
  };
  return ISSUE_TYPES.filter((t) => g[t]).map((t) => ({ type: t, detail: details[t] }));
}

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
    const id = `DEV-${pad(i + 1)}`;
    const scenario = SCENARIOS[i % SCENARIOS.length];
    const useFishbone = rand() < 0.5; // 5 Whys / Fishbone 균형
    let g: GoldLabels;
    if (i === 0) g = Object.fromEntries(ISSUE_TYPES.map((t) => [t, false])) as GoldLabels;
    else if (i === 1) g = Object.fromEntries(ISSUE_TYPES.map((t) => [t, true])) as GoldLabels;
    else g = makeLabels();

    cases.push({
      id,
      difficulty: difficulty(g),
      draft: buildDraft(scenario, g, id, useFishbone),
      gold_labels: g,
      expected_issues: expectedIssues(g),
    });
  }

  const outDir = join(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "dataset.json"), JSON.stringify(cases, null, 2), "utf8");

  const dist = Object.fromEntries(ISSUE_TYPES.map((t) => [t, cases.filter((c) => c.gold_labels[t]).length]));
  const fb = cases.filter((c) => c.draft.includes("☒ Fishbone")).length;
  console.log(`생성 완료: ${cases.length}건 → data/dataset.json`);
  console.log("유형별 결함 포함 건수:", dist);
  console.log(`RCA 방법: Fishbone ${fb} / 5 Whys ${cases.length - fb}`);
  const diff = { easy: 0, medium: 0, hard: 0 };
  cases.forEach((c) => diff[c.difficulty]++);
  console.log("난이도 분포:", diff);
}

main();
