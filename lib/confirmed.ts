import { DEFAULT_PROMPTS } from "./prompts";

/** 랩에서 확정("배포")한 프롬프트를 리뷰어 화면으로 전달 (localStorage). */
const KEY = "deviation.confirmedPrompt";

export interface ConfirmedPrompt {
  versionId: string;
  label: string;
  system: string;
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
    if (raw) return JSON.parse(raw) as ConfirmedPrompt;
  } catch {}
  // 기본값: v2 (개선 버전)
  return {
    versionId: "v2",
    label: DEFAULT_PROMPTS.v2.label,
    system: DEFAULT_PROMPTS.v2.system,
    at: "default",
  };
}
