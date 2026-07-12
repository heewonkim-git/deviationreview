import Anthropic from "@anthropic-ai/sdk";
import { AGENT_OUTPUT_SCHEMA } from "./schema";
import {
  AgentIssue,
  AgentOutput,
  DeviationCase,
  IssueType,
  ISSUE_TYPES,
} from "./types";

/**
 * Review Agent — 편차 초안을 검토해 구조화 JSON을 산출한다.
 *
 * 두 경로:
 *  1) 실제 Claude (ANTHROPIC_API_KEY 존재 시) — output_config.format으로 스키마 강제.
 *  2) Mock (키 없음) — 결정적 휴리스틱. 오프라인 데모용이며 v1(naive)은
 *     의도적으로 노이즈를 넣어 v2(tuned)보다 지표가 낮게 나오도록 한다.
 */

export interface ReviewResult {
  output: AgentOutput | null;
  ruleCompliant: boolean;
  error?: string;
  source: "claude" | "mock";
}

export function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const MODEL = process.env.REVIEW_MODEL || "claude-opus-4-8";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

/** 스키마 준수 여부를 검사하며 AgentOutput으로 강제 변환. */
function coerce(raw: unknown, caseId: string): AgentOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.issues)) return null;
  const issues: AgentIssue[] = [];
  for (const it of obj.issues) {
    if (!it || typeof it !== "object") return null;
    const i = it as Record<string, unknown>;
    if (!ISSUE_TYPES.includes(i.type as IssueType)) return null;
    if (!["low", "medium", "high"].includes(i.severity as string)) return null;
    issues.push({
      type: i.type as IssueType,
      severity: i.severity as AgentIssue["severity"],
      evidence: String(i.evidence ?? ""),
      explanation: String(i.explanation ?? ""),
    });
  }
  const verdict = obj.overall_verdict;
  if (!["pass", "needs_revision", "fail"].includes(verdict as string)) return null;
  return {
    case_id: caseId,
    issues,
    overall_verdict: verdict as AgentOutput["overall_verdict"],
  };
}

async function reviewWithClaude(
  testCase: DeviationCase,
  systemPrompt: string
): Promise<ReviewResult> {
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: AGENT_OUTPUT_SCHEMA as object },
      },
      messages: [
        {
          role: "user",
          content: `case_id: ${testCase.id}\n\n[편차 초안]\n${testCase.draft}`,
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming);

    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text")
      return { output: null, ruleCompliant: false, error: "빈 응답", source: "claude" };

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return { output: null, ruleCompliant: false, error: "JSON 파싱 실패", source: "claude" };
    }
    const output = coerce(parsed, testCase.id);
    return { output, ruleCompliant: output !== null, source: "claude" };
  } catch (e) {
    return {
      output: null,
      ruleCompliant: false,
      error: e instanceof Error ? e.message : String(e),
      source: "claude",
    };
  }
}

// ---- Mock 경로 ----
/** 초안 텍스트에서 결함 마커를 읽어 "진짜" 결함을 판정 (정답에 가까운 신호). */
function trueSignals(draft: string): Record<IssueType, boolean> {
  return {
    // RCA(5 Whys/Fishbone 공통) 미완결
    missing_rca: draft.includes("근본원인 분석 미완결"),
    weak_root_cause: draft.includes("작업자의 부주의로 판단"),
    missing_capa: !draft.includes("예방조치(Preventive)"),
    unsupported_claims:
      draft.includes("영향은 없는 것으로 판단된다") && !draft.includes("첨부 Data"),
    logical_issues: draft.includes("별도 조치 없이 배치를 출하"),
  };
}

// 결정적 의사난수 (케이스 id 해시 기반) — mock 노이즈 재현성 확보.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function reviewWithMock(
  testCase: DeviationCase,
  profile: "naive" | "tuned"
): ReviewResult {
  const sig = trueSignals(testCase.draft);
  const issues: AgentIssue[] = [];
  for (const t of ISSUE_TYPES) {
    let detected = sig[t];
    const r = hash(testCase.id + t);
    if (profile === "naive") {
      // v1: 오탐/누락 노이즈를 크게 주입 (유형·케이스별 결정적).
      if (!detected && r < 0.18) detected = true; // 오탐(FP)
      if (detected && r > 0.82) detected = false; // 누락(FN)
    } else {
      // v2: 개선됐지만 완벽하지 않음 — 소량의 잔여 오류(≈3~4%)를 남겨
      //     "개선된 프롬프트도 검증이 필요하다"는 교훈을 유지.
      if (!detected && r < 0.03) detected = true;
      if (detected && r > 0.965) detected = false;
    }
    if (detected) {
      issues.push({
        type: t,
        severity: "medium",
        evidence: "(mock) 초안 내 관련 서술",
        explanation: "(mock) 규칙 휴리스틱 기반 판정",
      });
    }
  }
  const verdict = issues.length === 0 ? "pass" : issues.length >= 3 ? "fail" : "needs_revision";
  return {
    output: { case_id: testCase.id, issues, overall_verdict: verdict },
    ruleCompliant: true,
    source: "mock",
  };
}

/**
 * 케이스 리뷰. useMock이 명시되면 강제 mock, 아니면 키 유무로 자동 선택.
 * mockProfile: 프롬프트 버전에 따른 mock 품질 (v1=naive, 그 외=tuned).
 */
export async function reviewCase(
  testCase: DeviationCase,
  systemPrompt: string,
  opts: { useMock?: boolean; mockProfile?: "naive" | "tuned" } = {}
): Promise<ReviewResult> {
  const useMock = opts.useMock ?? !hasApiKey();
  if (useMock) return reviewWithMock(testCase, opts.mockProfile ?? "tuned");
  const res = await reviewWithClaude(testCase, systemPrompt);
  // Claude 호출 실패(크레딧 부족·레이트리밋 등) → Mock으로 자동 폴백해 데모가 끊기지 않게 함.
  if (res.error || !res.output) {
    const m = reviewWithMock(testCase, opts.mockProfile ?? "tuned");
    return { output: m.output, ruleCompliant: m.ruleCompliant, source: "mock" };
  }
  return res;
}
