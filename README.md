# Deviation Review Agent · Evaluation Lab

LLM 시스템을 **배포 전에 어떻게 검증(Validation)하는가**를 보여주는 교육용 SPA.
편차(Deviation) 리포트를 검토하는 Claude 기반 Review Agent를 만들고, 100건의 합성
데이터셋에 대해 **규칙 기반 평가**를 돌려 지표로 신뢰도를 증명한다.

> LLM은 모델이다 · 모델은 검증을 요구한다 · **프롬프트를 믿지 말고 평가를 믿어라.**

자세한 요구사항은 [`PRD.md`](./PRD.md), 작업 규칙은 [`CLAUDE.md`](./CLAUDE.md) 참조.

## 구조

| 경로 | 역할 |
|---|---|
| `app/page.tsx` | 4분할 SPA (Prompt Editor · Evaluation Progress · Metrics · Failure Explorer) |
| `app/api/run` | 데이터셋 실행 → 케이스별 평가를 SSE로 스트리밍 |
| `lib/reviewer.ts` | Review Agent — Claude(구조화 JSON) 또는 오프라인 Mock |
| `lib/evaluate.ts` | 규칙 기반 평가 엔진 (유형 단위 · 6대 지표) |
| `lib/prompts.ts` | 프롬프트 v1(초기) / v2(개선) |
| `data/dataset.json` | 합성 편차 리포트 100건 (Gold Labels 포함) |
| `design-system/tokens.css` | 공유 디자인 시스템 토큰 (Samsung Blue v1.1.0) |

## 로컬 실행

```bash
npm install
npm run dev          # http://localhost:3000
```

- **API 키 없이도 동작**한다 — `ANTHROPIC_API_KEY` 가 없으면 결정적 **Mock 리뷰어**로 실행되며,
  v1은 의도적으로 노이즈가 있어 v2보다 지표가 낮게 나온다(개선 스토리 시연).
- 실제 Claude로 리뷰하려면 `.env.local` 에 키를 넣는다:

```bash
cp .env.local.example .env.local   # ANTHROPIC_API_KEY=sk-ant-... 입력
```

## 데이터셋 · 검증

```bash
npm run gen:data     # 100건 재생성 (결정적/시드)
npm run check:data   # 스키마·라벨·분포 검수
npx tsx scripts/smoke.ts   # 파이프라인 스모크 (v1 vs v2 지표)
```

## Vercel 배포

1. 이 저장소를 GitHub에 push (또는 `vercel` CLI 사용).
2. Vercel에서 프로젝트 import — Next.js 자동 감지, 추가 설정 불필요.
3. (선택) 환경변수 `ANTHROPIC_API_KEY` 추가 → 실제 Claude 실행. 미설정 시 Mock 모드로 데모 동작.

메모:
- 데이터셋 JSON은 API 라우트에서 **정적 import** 로 번들에 포함된다(서버리스 파일 읽기 이슈 없음).
- `/api/run` 은 `maxDuration = 60` 으로 설정. Claude 100건 실행은 시간이 걸릴 수 있으니
  데모에서는 케이스 수(20/50/100)를 조절하거나 Mock 모드를 사용한다.
