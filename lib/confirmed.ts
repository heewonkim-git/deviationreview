import { DEFAULT_PROMPTS } from "./prompts";
import { DEFAULT_MODEL } from "./models";

/** Operation에서 배포한 프롬프트를 Review 화면으로 전달 (localStorage). */
const KEY = "deviation.confirmedPrompt";

export interface ConfirmedPrompt {
  versionId: string; // 예: "v2", "v3"
  version: number; // 예: 2, 3 → Review 화면에 "Prompt version : 2.0"
  label: string;
  system: string;
  model: string; // 배포된 모델 (고급 추론 / 가격 경쟁력)
  f1?: number;
  at: string;
}

export function saveConfirmed(p: ConfirmedPrompt) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export function loadConfirmed(): ConfirmedPrompt {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as ConfirmedPrompt;
      if (typeof p.version !== "number") p.version = p.versionId === "v1" ? 1 : 2;
      if (!p.model) p.model = DEFAULT_MODEL;
      return p;
    }
  } catch {}
  // 기본값: v2 (개선 버전)
  return {
    versionId: "v2",
    version: 2,
    label: DEFAULT_PROMPTS.v2.label,
    system: DEFAULT_PROMPTS.v2.system,
    model: DEFAULT_MODEL,
    at: "default",
  };
}
