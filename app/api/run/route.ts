import { NextRequest } from "next/server";
import { DeviationCase, CaseEvaluation } from "@/lib/types";
import { aggregateMetrics, evaluateCase } from "@/lib/evaluate";
import { hasApiKey, reviewCase } from "@/lib/reviewer";
// JSON을 정적 import — Vercel 서버리스 번들에 포함되도록 (readFileSync는 번들 누락 위험).
import datasetJson from "@/data/dataset.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 다수 케이스 채점을 위해 최대 지속시간 확대(5분). Pro 플랜에서 적용, Hobby는 60초로 강제됨.
export const maxDuration = 300;

function loadDataset(): DeviationCase[] {
  return datasetJson as DeviationCase[];
}

interface RunBody {
  system: string;
  promptId?: string; // mock 품질 결정 (v1=naive)
  useMock?: boolean;
  limit?: number; // 케이스 수 제한 (빠른 데모)
  concurrency?: number;
}

/**
 * POST /api/run — 데이터셋을 실행하며 케이스별 평가 결과를 SSE로 스트리밍.
 * 이벤트: meta(총 건수/모드) → case(케이스별 평가) × N → done(집계 지표).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as RunBody;
  const dataset = loadDataset();
  const cases = body.limit ? dataset.slice(0, body.limit) : dataset;
  const useMock = body.useMock ?? !hasApiKey();
  const mockProfile: "naive" | "tuned" = body.promptId === "v1" ? "naive" : "tuned";
  // Vercel 함수 60초 제한 안에 100건을 끝내려면 동시성을 높인다.
  const concurrency = Math.max(1, Math.min(body.concurrency ?? (useMock ? 24 : 12), 24));

  const encoder = new TextEncoder();
  const evaluations: CaseEvaluation[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("meta", { total: cases.length, mode: useMock ? "mock" : "claude", promptId: body.promptId });

      let index = 0;
      async function worker() {
        while (index < cases.length) {
          const my = index++;
          const c = cases[my];
          try {
            const res = await reviewCase(c, body.system, { useMock, mockProfile });
            const evaluation = evaluateCase(c, res.output, res.ruleCompliant, res.error);
            evaluations.push(evaluation);
            send("case", {
              index: my,
              done: evaluations.length,
              case: {
                id: c.id,
                difficulty: c.difficulty,
                draft: c.draft,
                gold_labels: c.gold_labels,
                expected_issues: c.expected_issues,
              },
              evaluation,
              source: res.source,
            });
          } catch (e) {
            const evaluation = evaluateCase(
              c,
              null,
              false,
              e instanceof Error ? e.message : String(e)
            );
            evaluations.push(evaluation);
            send("case", { index: my, done: evaluations.length, case: { id: c.id }, evaluation });
          }
        }
      }

      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      const metrics = aggregateMetrics(evaluations);
      send("done", { metrics });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
