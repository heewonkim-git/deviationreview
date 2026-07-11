import { DeviationCase } from "@/lib/types";
import { hasApiKey } from "@/lib/reviewer";
import datasetJson from "@/data/dataset.json";

export const runtime = "nodejs";

/** GET /api/dataset — 데이터셋 요약(건수/분포/모드)과 프롬프트 기본값 제공. */
export async function GET() {
  const cases = datasetJson as DeviationCase[];
  const diff = { easy: 0, medium: 0, hard: 0 };
  cases.forEach((c) => diff[c.difficulty]++);
  return Response.json({
    total: cases.length,
    difficulty: diff,
    mode: hasApiKey() ? "claude" : "mock",
  });
}
