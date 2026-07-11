import {
  AgentOutput,
  CaseEvaluation,
  Confusion,
  DeviationCase,
  IssueType,
  ISSUE_LABELS,
  ISSUE_TYPES,
  Metrics,
} from "./types";

/**
 * 규칙 기반 평가 — 결정적(재현 가능). LLM 심판을 쓰지 않는다.
 * 매칭 단위는 "유형(type-level)": 5개 이슈 유형별로 지적 여부(있음/없음)를 Gold와 대조.
 */

/** 에이전트 출력을 유형별 boolean 예측으로 환원. */
function predictedByType(output: AgentOutput | null): Record<IssueType, boolean> {
  const base = Object.fromEntries(ISSUE_TYPES.map((t) => [t, false])) as Record<
    IssueType,
    boolean
  >;
  if (!output) return base;
  for (const issue of output.issues) {
    if (ISSUE_TYPES.includes(issue.type)) base[issue.type] = true;
  }
  return base;
}

function outcome(predicted: boolean, gold: boolean): "TP" | "FP" | "FN" | "TN" {
  if (predicted && gold) return "TP";
  if (predicted && !gold) return "FP";
  if (!predicted && gold) return "FN";
  return "TN";
}

/**
 * 한 케이스 평가.
 * @param ruleCompliant  에이전트 출력이 스키마/규칙을 준수했는지 (라우트에서 판정해 전달).
 */
export function evaluateCase(
  testCase: DeviationCase,
  output: AgentOutput | null,
  ruleCompliant: boolean,
  error?: string
): CaseEvaluation {
  const predicted = predictedByType(output);
  const perType = {} as CaseEvaluation["perType"];
  let allCorrect = true;
  const mismatches: string[] = [];

  for (const t of ISSUE_TYPES) {
    const gold = testCase.gold_labels[t];
    const pred = predicted[t];
    const oc = outcome(pred, gold);
    perType[t] = { predicted: pred, gold, outcome: oc };
    if (oc === "FP" || oc === "FN") {
      allCorrect = false;
      mismatches.push(
        `${ISSUE_LABELS[t]}: ${oc === "FP" ? "오탐(없는 이슈 지적)" : "누락(실제 이슈 놓침)"}`
      );
    }
  }

  // PASS 기준: 모든 유형 판정이 정답과 일치 + 규칙 준수.
  const pass = allCorrect && ruleCompliant;

  let reason: string;
  if (error) reason = `오류: ${error}`;
  else if (!ruleCompliant) reason = "규칙 위반: 출력 스키마/형식 불충족";
  else if (pass) reason = "모든 유형 판정 일치";
  else reason = mismatches.join(" · ");

  return {
    case_id: testCase.id,
    pass,
    perType,
    ruleCompliant,
    reason,
    agentOutput: output,
    error,
  };
}

function emptyConfusion(): Confusion {
  return { tp: 0, fp: 0, fn: 0, tn: 0 };
}

function addOutcome(c: Confusion, oc: "TP" | "FP" | "FN" | "TN") {
  if (oc === "TP") c.tp++;
  else if (oc === "FP") c.fp++;
  else if (oc === "FN") c.fn++;
  else c.tn++;
}

function precision(c: Confusion) {
  return c.tp + c.fp === 0 ? 0 : c.tp / (c.tp + c.fp);
}
function recall(c: Confusion) {
  return c.tp + c.fn === 0 ? 0 : c.tp / (c.tp + c.fn);
}
function f1FromPR(p: number, r: number) {
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

/**
 * 케이스 평가 목록 → 6대 지표 집계.
 * Micro 평균(전체 혼동행렬 기준) + per-type 세분 지표 제공.
 */
export function aggregateMetrics(evals: CaseEvaluation[]): Metrics {
  const overall = emptyConfusion();
  const perTypeConf = Object.fromEntries(
    ISSUE_TYPES.map((t) => [t, emptyConfusion()])
  ) as Record<IssueType, Confusion>;

  let ruleCompliantCount = 0;
  let agreementCount = 0; // Human Agreement: 유형 단위 판정이 gold와 일치한 수
  let agreementTotal = 0;

  for (const ev of evals) {
    if (ev.ruleCompliant) ruleCompliantCount++;
    for (const t of ISSUE_TYPES) {
      const oc = ev.perType[t].outcome;
      addOutcome(overall, oc);
      addOutcome(perTypeConf[t], oc);
      agreementTotal++;
      if (oc === "TP" || oc === "TN") agreementCount++;
    }
  }

  const p = precision(overall);
  const r = recall(overall);
  const accuracy =
    agreementTotal === 0 ? 0 : (overall.tp + overall.tn) / agreementTotal;

  const perType = {} as Metrics["perType"];
  for (const t of ISSUE_TYPES) {
    const c = perTypeConf[t];
    const pp = precision(c);
    const rr = recall(c);
    perType[t] = { precision: pp, recall: rr, f1: f1FromPR(pp, rr), confusion: c };
  }

  const total = evals.length;
  const passed = evals.filter((e) => e.pass).length;

  return {
    accuracy,
    precision: p,
    recall: r,
    f1: f1FromPR(p, r),
    ruleCompliance: total === 0 ? 0 : ruleCompliantCount / total,
    humanAgreement: agreementTotal === 0 ? 0 : agreementCount / agreementTotal,
    confusion: overall,
    perType,
    total,
    passed,
    failed: total - passed,
  };
}
