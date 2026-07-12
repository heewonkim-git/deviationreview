/** Review Agent가 쓸 수 있는 모델 — 고급 추론 vs 가격 경쟁력. */
export const MODELS = [
  { id: "claude-opus-4-8", label: "고급 추론 모델 (Claude Opus 4.8)", short: "Opus 4.8" },
  { id: "claude-haiku-4-5", label: "가격 경쟁력 모델 (Claude Haiku 4.5)", short: "Haiku 4.5" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];
export const DEFAULT_MODEL: string = MODELS[0].id;

export function modelShort(id: string | undefined): string {
  return MODELS.find((m) => m.id === id)?.short ?? (id ?? "—");
}
export function modelLabel(id: string | undefined): string {
  return MODELS.find((m) => m.id === id)?.label ?? (id ?? "—");
}
