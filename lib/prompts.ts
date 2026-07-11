/**
 * 프롬프트 버전 정의.
 * v1: 순진한 초기 프롬프트 (의도적으로 약함 — 실패를 만들어 개선 여지를 보여줌).
 * v2: 실패 분석을 반영해 개선한 프롬프트.
 * UI의 Prompt Editor에서 이 문자열을 편집/교체할 수 있다.
 */

export interface PromptVersion {
  id: string;
  label: string;
  system: string;
}

const OUTPUT_CONTRACT = `
출력 규칙:
- 반드시 지정된 JSON 스키마로만 응답한다.
- issues 배열에는 "실제로 존재한다고 판단한 이슈"만 담는다. 문제가 없으면 빈 배열.
- 각 이슈는 type, severity(low|medium|high), evidence(초안 인용), explanation(왜 문제인지)을 포함한다.
- overall_verdict: 이슈가 없으면 "pass", 경미하면 "needs_revision", 중대하면 "fail".
- case_id 필드에는 입력으로 받은 case_id를 그대로 넣는다.
`.trim();

const ISSUE_DEFINITIONS = `
검토할 이슈 유형 (정확히 이 5가지):
- missing_5whys: 5 Whys 근본원인 분석이 없거나 중간에 끊겨 완결되지 않음.
- weak_root_cause: 근본 원인이 증상 수준에 머무르거나 근거가 약함.
- missing_capa: 시정·예방 조치(CAPA)가 누락됨.
- unsupported_claims: 데이터/근거 없이 단정하는 주장.
- logical_issues: 결론이 근거와 모순되는 등 논리적 비일관성.
`.trim();

/** v1 — 순진한 버전. 기준이 모호하고 예시가 없어 오탐/누락이 잦다. */
export const PROMPT_V1: PromptVersion = {
  id: "v1",
  label: "Prompt v1 (초기)",
  system: `당신은 제약 편차(Deviation) 리포트를 검토하는 리뷰어입니다.
아래 초안을 읽고 문제점을 찾아 지적하세요.

${ISSUE_DEFINITIONS}

${OUTPUT_CONTRACT}`,
};

/** v2 — 실패 분석 반영. 각 유형의 판정 기준을 명확히 하고, 과도한 오탐을 억제. */
export const PROMPT_V2: PromptVersion = {
  id: "v2",
  label: "Prompt v2 (개선)",
  system: `당신은 제약 편차(Deviation) 리포트를 검토하는 숙련된 QA 리뷰어입니다.
초안을 정밀하게 검토하되, "실제로 존재하는" 결함만 지적하세요. 추측으로 이슈를 만들지 마십시오.

${ISSUE_DEFINITIONS}

판정 기준 (엄격히 적용):
- missing_5whys: "왜"가 5회에 미치지 못하거나 인과 사슬이 근본원인에 도달하기 전에 끊긴 경우에만 지적. 5 Whys가 완결되어 있으면 지적하지 말 것.
- weak_root_cause: 근본 원인이 "인적 실수" "부주의" 같은 증상/비난 수준에 머문 경우. 프로세스·시스템 수준 원인이 명시되어 있으면 지적하지 말 것.
- missing_capa: 시정(Corrective)과 예방(Preventive) 조치 중 하나라도 명시되지 않은 경우. 둘 다 있으면 지적하지 말 것.
- unsupported_claims: "~로 확인되었다" 등 결론이 있으나 이를 뒷받침하는 데이터·측정·기록이 초안에 없을 때만. 근거가 인용되어 있으면 지적하지 말 것.
- logical_issues: 결론이 제시된 근거와 직접 모순되거나, 원인과 조치가 연결되지 않는 경우.

주의:
- 각 유형은 독립적으로 판단한다. 한 문제가 있다고 다른 유형까지 함부로 지적하지 말 것.
- 근거(evidence)는 반드시 초안의 실제 문장을 인용한다.

${OUTPUT_CONTRACT}`,
};

export const DEFAULT_PROMPTS: Record<string, PromptVersion> = {
  v1: PROMPT_V1,
  v2: PROMPT_V2,
};
