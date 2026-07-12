// 핵심 도메인 타입 정의 — PRD.md 참조.

/** 에이전트가 검토하는 5가지 이슈 유형 (유형 단위 매칭의 기준). */
export const ISSUE_TYPES = [
  "missing_rca",
  "weak_root_cause",
  "missing_capa",
  "unsupported_claims",
  "logical_issues",
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

/** 사람이 읽는 이슈 유형 라벨. */
export const ISSUE_LABELS: Record<IssueType, string> = {
  // RCA는 5 Whys 또는 Fishbone 중 선택된 방법이 부실/미완인 경우 (방법 무관, RCA 수준의 정확도).
  missing_rca: "Root Cause Analysis",
  weak_root_cause: "Weak Root Cause",
  missing_capa: "Missing CAPA",
  unsupported_claims: "Unsupported Claims",
  logical_issues: "Logical Issues",
};

export type Severity = "low" | "medium" | "high";
export type Verdict = "pass" | "needs_revision" | "fail";

/** 각 유형별 정답 라벨 (존재 여부). */
export type GoldLabels = Record<IssueType, boolean>;

/** 검증 데이터셋의 한 케이스. */
export interface DeviationCase {
  id: string;
  /** 난이도 — 분포 검수용. */
  difficulty: "easy" | "medium" | "hard";
  draft: string;
  gold_labels: GoldLabels;
  expected_issues: { type: IssueType; detail: string }[];
}

/** 에이전트가 지적한 하나의 이슈. */
export interface AgentIssue {
  type: IssueType;
  severity: Severity;
  evidence: string;
  explanation: string;
}

/** 에이전트의 구조화 출력. */
export interface AgentOutput {
  case_id: string;
  issues: AgentIssue[];
  overall_verdict: Verdict;
}

/** 한 케이스에 대한 평가 결과. */
export interface CaseEvaluation {
  case_id: string;
  pass: boolean;
  /** 유형별 판정 결과: 예측 vs 정답. */
  perType: Record<
    IssueType,
    { predicted: boolean; gold: boolean; outcome: "TP" | "FP" | "FN" | "TN" }
  >;
  /** JSON 스키마/규칙 준수 여부 (Rule Compliance 계측). */
  ruleCompliant: boolean;
  /** 실패 사유 (사람이 읽는 요약). */
  reason: string;
  agentOutput: AgentOutput | null;
  error?: string;
}

/** 혼동행렬 카운트. */
export interface Confusion {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

/** 지표 묶음. */
export interface Metrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  ruleCompliance: number;
  humanAgreement: number;
  confusion: Confusion;
  /** 유형별 세분 지표. */
  perType: Record<IssueType, { precision: number; recall: number; f1: number; confusion: Confusion }>;
  /** 집계된 케이스 수. */
  total: number;
  passed: number;
  failed: number;
}
