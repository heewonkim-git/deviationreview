import { NextRequest } from "next/server";
import { DeviationCase, CaseEvaluation, IssueType, ISSUE_TYPES } from "@/lib/types";
import { aggregateMetrics, evaluateCase } from "@/lib/evaluate";
import { hasApiKey, reviewCase } from "@/lib/reviewer";
import datasetJson from "@/data/dataset.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/consistency — 표본 케이스를 ×repeats회 반복 리뷰해 실행 간 일관성을 측정.
 * LLM은 확률적이라 1회 채점만으로는 안정성을 알 수 없다 → 반복 실행의 F1 분포(평균·표준편차)를 반환.
 */
export async function POST(req: NextRequest) {
  const { system, promptId, sample = 10, repeats = 10, model } = (await req.json()) as {
    system: string;
    promptId?: string;
    sample?: number;
    repeats?: number;
    model?: string;
  };
  const dataset = datasetJson as unknown as DeviationCase[];
  const cases = dataset.slice(0, Math.max(1, Math.min(sample, dataset.length)));
  const useMock = !hasApiKey();
  const mockProfile: "naive" | "tuned" = promptId === "v1" ? "naive" : "tuned";

  // (run × case) 작업을 동시성 풀로 처리
  const tasks: { r: number; i: number }[] = [];
  for (let r = 0; r < repeats; r++) for (let i = 0; i < cases.length; i++) tasks.push({ r, i });
  const perRun: CaseEvaluation[][] = Array.from({ length: repeats }, () => []);

  let idx = 0;
  // 병렬 처리로 빠르게 (표본 10 × 반복 10 = 100콜을 여러 워커가 동시에)
  const concurrency = Math.min(useMock ? 32 : 16, tasks.length);
  async function worker() {
    while (idx < tasks.length) {
      const { r, i } = tasks[idx++];
      const c = cases[i];
      const res = await reviewCase(c, system, { useMock, mockProfile, model });
      perRun[r].push(evaluateCase(c, res.output, res.ruleCompliant, res.error));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const runs = perRun.map((evals) => {
    const m = aggregateMetrics(evals);
    const perType = Object.fromEntries(ISSUE_TYPES.map((t) => [t, m.perType[t].f1])) as Record<IssueType, number>;
    return { f1: m.f1, perType };
  });

  return Response.json({ runs, mode: useMock ? "mock" : "claude", sample: cases.length, repeats });
}
