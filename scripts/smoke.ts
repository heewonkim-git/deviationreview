/**
 * 파이프라인 스모크 테스트 (서버 불필요).
 * mock 리뷰어로 100건을 v1(naive)/v2(tuned) 프롬프트로 평가하고 지표를 출력.
 * 실행: npx tsx scripts/smoke.ts
 */
import dataset from "../data/dataset.json";
import { DeviationCase } from "../lib/types";
import { reviewCase } from "../lib/reviewer";
import { aggregateMetrics, evaluateCase } from "../lib/evaluate";
import { DEFAULT_PROMPTS } from "../lib/prompts";

async function runOne(profile: "naive" | "tuned") {
  const cases = dataset as unknown as DeviationCase[];
  const evals = [];
  for (const c of cases) {
    const r = await reviewCase(c, DEFAULT_PROMPTS[profile === "naive" ? "v1" : "v2"].system, {
      useMock: true,
      mockProfile: profile,
    });
    evals.push(evaluateCase(c, r.output, r.ruleCompliant, r.error));
  }
  return aggregateMetrics(evals);
}

async function main() {
  const v1 = await runOne("naive");
  const v2 = await runOne("tuned");
  const pctf = (n: number) => (n * 100).toFixed(1) + "%";
  const line = (label: string, a: number, b: number) =>
    console.log(
      `  ${label.padEnd(16)} v1 ${pctf(a).padStart(7)}   →   v2 ${pctf(b).padStart(7)}   (${
        b - a >= 0 ? "+" : ""
      }${((b - a) * 100).toFixed(1)}p)`
    );
  console.log("=== 파이프라인 스모크 (mock, 100건) ===");
  line("Accuracy", v1.accuracy, v2.accuracy);
  line("Precision", v1.precision, v2.precision);
  line("Recall", v1.recall, v2.recall);
  line("F1", v1.f1, v2.f1);
  line("RuleCompliance", v1.ruleCompliance, v2.ruleCompliance);
  line("HumanAgreement", v1.humanAgreement, v2.humanAgreement);
  console.log(`  PASS  v1 ${v1.passed}/${v1.total}   →   v2 ${v2.passed}/${v2.total}`);
  console.log(
    `  혼동행렬 v1 TP${v1.confusion.tp} FP${v1.confusion.fp} FN${v1.confusion.fn} TN${v1.confusion.tn}` +
      `  |  v2 TP${v2.confusion.tp} FP${v2.confusion.fp} FN${v2.confusion.fn} TN${v2.confusion.tn}`
  );
  if (v2.f1 <= v1.f1) {
    console.error("경고: v2 F1이 v1보다 개선되지 않음 — 데모 스토리 확인 필요");
    process.exit(1);
  }
  console.log("OK: v2가 v1 대비 F1 개선 — 데모 스토리 성립");
}
main();
