import { ISSUE_TYPES } from "./types";

/**
 * Review Agent의 구조화 출력 강제용 JSON 스키마.
 * Claude structured outputs(output_config.format)에 그대로 전달된다.
 * 제약: additionalProperties:false + required 전부 명시 (구조화 출력 규칙).
 */
export const AGENT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    case_id: { type: "string" },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: [...ISSUE_TYPES] },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          evidence: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["type", "severity", "evidence", "explanation"],
      },
    },
    overall_verdict: {
      type: "string",
      enum: ["pass", "needs_revision", "fail"],
    },
  },
  required: ["case_id", "issues", "overall_verdict"],
} as const;
