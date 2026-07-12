/**
 * Review Agent가 쓸 수 있는 모델 — 고급 추론 vs 가격 경쟁력.
 * 단가는 Anthropic 공식 가격표(1M 토큰당, USD). speed는 정성 표기(공식 고정 배수 미공표).
 */
export const MODELS = [
  { id: "claude-opus-4-8", label: "고급 추론 모델 (Claude Opus 4.8)", short: "Opus 4.8", in: 5, out: 25, speed: "표준 (최고 성능·추론)" },
  { id: "claude-haiku-4-5", label: "가격 경쟁력 모델 (Claude Haiku 4.5)", short: "Haiku 4.5", in: 1, out: 5, speed: "최속 티어 (가장 빠름)" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];
export const DEFAULT_MODEL: string = MODELS[0].id;

export function modelShort(id: string | undefined): string {
  return MODELS.find((m) => m.id === id)?.short ?? (id ?? "—");
}
export function modelLabel(id: string | undefined): string {
  return MODELS.find((m) => m.id === id)?.label ?? (id ?? "—");
}
