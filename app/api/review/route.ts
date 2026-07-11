import { NextRequest } from "next/server";
import { DeviationCase } from "@/lib/types";
import { reviewCase } from "@/lib/reviewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/review — 편차 초안 1건을 확정 프롬프트로 리뷰 (실사용/리뷰어 화면용).
 * 정답지·평가 없음. 에이전트의 구조화 리뷰 결과(AgentOutput)만 반환.
 */
export async function POST(req: NextRequest) {
  const { draft, system, useMock, promptId } = (await req.json()) as {
    draft: string;
    system: string;
    useMock?: boolean;
    promptId?: string;
  };
  const testCase: DeviationCase = {
    id: "USER-INPUT",
    difficulty: "medium",
    draft,
    gold_labels: {
      missing_5whys: false,
      weak_root_cause: false,
      missing_capa: false,
      unsupported_claims: false,
      logical_issues: false,
    },
    expected_issues: [],
  };
  const res = await reviewCase(testCase, system, {
    useMock,
    mockProfile: promptId === "v1" ? "naive" : "tuned",
  });
  return Response.json({
    output: res.output,
    ruleCompliant: res.ruleCompliant,
    source: res.source,
    error: res.error,
  });
}
