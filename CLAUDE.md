# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code를 위한 운영 지침이다.
상세 요구사항은 `PRD.md`를 참조한다.

## 이 프로젝트가 무엇인가

**Deviation Review Agent Evaluation Lab** — LLM 시스템을 배포 전에 어떻게 검증(Validation)하는지를 보여주는 **교육용 SPA**.

편차(Deviation) 리포트를 검토하는 Claude 기반 Review Agent를 만들고,
100개 합성 데이터셋에 대해 **규칙 기반 평가**를 돌려 지표로 신뢰도를 증명한다.

## 절대 잊지 말 것 (핵심 원칙)

1. **목표는 더 좋은 텍스트 생성이 아니다. 목표는 평가로 신뢰를 구축하는 것이다.**
   - 기능을 추가할 때 "이게 평가/신뢰를 강화하는가?"를 먼저 물어라.
2. **평가는 규칙 기반(결정적)이다.** LLM 심판을 평가 채점에 쓰지 마라 — 재현성이 핵심.
3. **에이전트 출력은 항상 구조화 JSON.** 스키마 위반은 Rule Compliance 지표로 계측한다.
4. **데이터는 100% 합성.** 실제 환자·제품 데이터를 넣지 마라.

## 도메인 체크리스트 (에이전트가 검토하는 5가지 이슈)

- Missing 5 Whys — 5 Whys 분석 누락/미완
- Weak Root Cause — 근본 원인이 약함/증상 수준
- Missing CAPA — 시정·예방 조치 누락
- Unsupported Claims — 근거 없는 주장
- Logical Issues — 논리적 비일관성

## 6대 평가 지표

Accuracy · Precision · Recall · F1 · Rule Compliance · Human Agreement
(계산 정의는 PRD 부록 A 참조. Micro/Macro 및 per-type 모두 제공.)

## UI 레이아웃 (SPA 4분할)

- Left: Prompt Editor (v1/v2)
- Center: Evaluation Progress (실시간 PASS/FAIL/사유)
- Right: Metrics Dashboard (지표 실시간 갱신)
- Bottom: Failure Explorer (실패 케이스 심층 분석)

## 프롬프트 라이프사이클

v1 → Evaluate → Failure Analysis → Improve → v2 → Re-evaluate → Deployment Decision

각 프롬프트 버전은 평가 결과 스냅샷과 함께 저장한다.

## Claude API 사용 규칙

- 기본 모델은 최신·최상위 모델(예: `claude-opus-4-8`)을 사용한다.
- 구조화 출력은 툴/JSON 스키마로 **강제**하고, 위반 시 재시도한다.
- API 키는 프론트에 노출하지 말 것 — 경량 백엔드 프록시로 은닉.
- 모델 id/가격/파라미터는 추측하지 말고 `claude-api` 스킬을 참조한다.

## 확정된 설계 결정

- **스택: Next.js 풀스택 (App Router)** — `app/`에 SPA UI, `app/api/review`·`app/api/evaluate` 라우트. Claude API 키는 서버 라우트에서만 사용(은닉).
- **평가 매칭: 유형 단위(type-level)** — 5개 이슈 유형별로 지적 여부(있음/없음)를 Gold와 대조해 TP/FP/FN/TN 산출. detail 단위 부분일치는 하지 않는다.
- **데이터셋: Claude 생성 + 스키마 검수** — 유형/난이도 분포를 먼저 설계 → Claude로 100건 생성 → 스크립트로 스키마·라벨 정합성 자동 검수 → 분포 리포트 확인.

## 디자인 시스템 (공유)

- **Golden Batch × Deviation Review 공용 디자인 시스템 v1.1.0 (Samsung Blue)** 를 채택한다.
- 토큰은 `design-system/tokens.css` 에 있으며 `app/globals.css` 가 `@import` 한다.
- **색을 하드코딩하지 말 것.** 항상 `var(--ds-*)` 역할 토큰을 참조한다 (브랜드 `--ds-brand`, 표면 `--ds-surface`, 의미색 `--ds-success/-warning/-danger/-info`, 역할 액센트 `--ds-accent-1..4`).
- 무드: 에디토리얼 — serif 헤딩/값(`--ds-font-serif`), system sans UI, mono 식별자·수치(`--ds-font-mono`). 14px 밀도형.
- **borders over shadows** (평면 패널은 테두리, 떠 있는 요소만 그림자).
- light/dark/system 3테마 — `prefers-color-scheme` + `:root[data-theme]`. 의미를 색만으로 표현하지 말 것.
- 이슈 유형→액센트 매핑: 5whys=accent-1, root_cause=accent-2, capa=accent-3, unsupported=accent-4, logical=info. PASS=success, FAIL=danger, TP/FP/FN=success/danger/warning.
- 토큰 변경은 **두 제품 모두 이득일 때만**, `tokens.css` + `--ds-version` 을 함께 올린다.

## 개발 컨벤션

- 개발: `npm run dev` (http://localhost:3000) · 빌드: `npm run build` · 실행: `npm start`
- 데이터셋: `npm run gen:data` 생성 → `npm run check:data` 검수. 파이프라인 스모크: `npx tsx scripts/smoke.ts`.
- 데이터셋(`data/dataset.json`)은 API 라우트에서 `readFileSync` 대신 **정적 import** 로 번들(Vercel 서버리스 호환).
- 주변 코드의 스타일·네이밍·주석 밀도에 맞춘다.

## 현재 상태

- [x] PRD 작성 (`PRD.md`)
- [x] CLAUDE.md 초안
- [ ] 기술 스택 확정
- [ ] 합성 데이터셋 100건
- [ ] Review Agent
- [ ] 규칙 기반 평가 엔진
- [ ] SPA UI
- [ ] v1/v2 비교 + 데모
