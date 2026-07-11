# PRD — Deviation Review Agent Evaluation Lab

> LLM 시스템을 배포하기 전에 **엔터프라이즈 AI가 어떻게 검증(Validation)하는가**를 보여주는 교육용 웹 애플리케이션

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 |
| 작성일 | 2026-07-12 |
| 상태 | Draft |
| 대상 도메인 | GMP / 품질(QA) — 편차(Deviation) 리포트 리뷰 |

---

## 1. 개요 (Overview)

제약·바이오 등 규제 산업에서 **편차 리포트(Deviation Report)**는 반복적인 수동 리뷰를 필요로 한다. 리뷰어는 5 Whys, Root Cause, CAPA, SOP 준수, 논리적 일관성을 매번 확인하지만, 사람의 리뷰는 **느리고 일관성이 떨어진다.**

본 프로젝트는 편차 리포트를 검토하는 **Review Agent(LLM 기반)**를 만들고, 그 에이전트를 **실제로 신뢰할 수 있는지 정량적으로 검증하는 전 과정**을 하나의 웹 앱으로 시연한다.

### 핵심 메시지
- **목표는 더 좋은 텍스트 생성이 아니다.**
- **목표는 평가를 통해 신뢰를 구축하는 것이다.**
- LLM은 모델이다. 모델은 검증을 요구한다. **프롬프트를 믿지 말고, 평가를 믿어라.**

---

## 2. 문제 정의 (Problem Statement)

| 문제 | 설명 |
|---|---|
| 반복 노동 | 편차 리포트 리뷰는 동일 체크리스트를 매번 수동 반복 |
| 느림 | 사람이 5 Whys·RCA·CAPA·SOP·논리를 일일이 확인 |
| 비일관성 | 리뷰어·컨디션에 따라 판정 기준이 흔들림 |
| 신뢰 부재 | LLM을 도입해도 "믿어도 되는가?"에 대한 근거가 없음 |

**Review Agent는 리뷰어를 대체하는 것이 아니라 보조(assist)한다.** 그리고 이 앱은 그 보조 도구를 **배포해도 되는지 판단하는 근거(Evaluation)**를 만든다.

---

## 3. 목표와 비목표 (Goals / Non-Goals)

### Goals
- G1. 편차 초안을 리뷰하여 **구조화된 이슈(JSON)**를 출력하는 Review Agent 제공
- G2. 100개의 합성 검증 데이터셋에 대해 **규칙 기반 평가** 수행
- G3. Accuracy / Precision / Recall / F1 / Rule Compliance / Human Agreement **6대 지표** 산출
- G4. 프롬프트 **v1 → 실패 분석 → v2 → 재평가** 라이프사이클 시연
- G5. 실시간으로 PASS/FAIL/사유와 지표를 갱신하는 **단일 페이지 앱(SPA)** 제공
- G6. "평가를 신뢰하라"는 **교육적 메시지** 전달

### Non-Goals
- N1. 실제 GMP 시스템 연동/배포 (교육·데모 목적)
- N2. 더 유창한 편차 리포트 **생성** (평가가 목적이지 생성이 목적이 아님)
- N3. 실제 환자·제품 데이터 사용 (100% 합성 데이터)
- N4. 다중 사용자 계정·권한·감사 추적(Audit trail) 등 프로덕션 규제 기능

---

## 4. 타깃 사용자 (Personas)

| 페르소나 | 목표 | 이 앱에서 얻는 것 |
|---|---|---|
| QA 리뷰어 / 심사자 | LLM 보조 도구를 믿어도 되는지 알고 싶음 | 지표로 신뢰 근거 확인 |
| AI/ML 엔지니어 | LLM 시스템의 평가 파이프라인 학습 | 프롬프트 버저닝·평가 루프 실습 |
| 규제·품질 리더 | "AI를 어떻게 검증했는가" 설명 필요 | 배포 결정(Deployment Decision) 근거 |
| 교육 대상(학생/신입) | 엔터프라이즈 AI 검증 개념 이해 | 전 과정 시각적 학습 |

---

## 5. 핵심 컨셉 & 파이프라인 (Core Flow)

```
Deviation Draft
      ↓
  Review Agent        ← Claude 기반, 구조화 JSON 출력
      ↓
    Issues
      ↓
Validation Dataset    ← Gold Labels / Expected Issues와 대조
      ↓
  Evaluation          ← 규칙 기반, 6대 지표 산출
      ↓
Prompt Improvement    ← 실패 분석(Failure Analysis)
      ↓
 Re-evaluation        ← v2로 재평가
      ↓
Deployment Decision   ← 배포 여부 판단
```

---

## 6. 기능 요구사항 (Functional Requirements)

### 6.1 Validation Dataset (검증 데이터셋)

- **100개의 합성 편차 리포트**로 구성.
- 각 케이스는 다음을 포함:

| 필드 | 설명 |
|---|---|
| `id` | 케이스 식별자 |
| `draft` | 편차 초안 텍스트 |
| `gold_labels` | 정답 라벨 (각 이슈 유형별 존재 여부/판정) |
| `expected_issues` | 에이전트가 지적해야 할 기대 이슈 목록 |

- 데이터셋은 **의도적으로 결함이 섞인 케이스**(Missing CAPA, Weak Root Cause 등)를 포함해야 평가가 의미를 가진다.
- 난이도/이슈 유형이 **균형 있게 분포**하도록 설계 (지표가 특정 유형에 편향되지 않도록).

**데이터 스키마 (예시)**
```json
{
  "id": "DEV-0001",
  "draft": "During batch B-2381 filling, temperature excursion observed...",
  "gold_labels": {
    "missing_5whys": true,
    "weak_root_cause": true,
    "missing_capa": false,
    "unsupported_claims": false,
    "logical_issues": true
  },
  "expected_issues": [
    { "type": "missing_5whys", "detail": "5 Whys 분석이 3단계에서 중단됨" },
    { "type": "weak_root_cause", "detail": "근본 원인이 증상 수준에 머무름" },
    { "type": "logical_issues", "detail": "결론이 근거와 불일치" }
  ]
}
```

### 6.2 Review Agent (리뷰 에이전트)

- **Claude 사용** (기본 모델: 최신·최상위 모델, 예: `claude-opus-4-8`).
- 다음 5가지 이슈 유형을 검토:

| 이슈 유형 | 체크 내용 |
|---|---|
| Missing 5 Whys | 5 Whys 분석 누락/미완 |
| Weak Root Cause | 근본 원인이 약하거나 증상 수준 |
| Missing CAPA | 시정·예방 조치(CAPA) 누락 |
| Unsupported Claims | 근거 없는 주장 |
| Logical Issues | 논리적 비일관성 |

- **출력은 반드시 구조화된 JSON** (평가 파이프라인이 파싱 가능해야 함).

**에이전트 출력 스키마 (예시)**
```json
{
  "case_id": "DEV-0001",
  "issues": [
    {
      "type": "missing_5whys",
      "severity": "high",
      "evidence": "…draft 인용…",
      "explanation": "왜 문제인지"
    }
  ],
  "overall_verdict": "needs_revision"
}
```

- JSON 스키마 위반 시 재시도/보정 로직 필요 (Rule Compliance 지표와 직결).

### 6.3 Evaluation Engine (평가 엔진)

- **규칙 기반 평가** — LLM 심판이 아닌 결정적 규칙으로 재현성 확보.
- Agent Output vs Gold Labels를 이슈 유형별로 매칭.
- **혼동 행렬(Confusion Matrix)** 기반 지표 산출:

| 지표 | 정의 |
|---|---|
| Accuracy | 전체 판정 중 정답 비율 |
| Precision | 에이전트가 지적한 이슈 중 실제 이슈 비율 |
| Recall | 실제 이슈 중 에이전트가 잡아낸 비율 |
| F1 | Precision·Recall 조화 평균 |
| Rule Compliance | JSON 스키마·출력 규칙 준수율 |
| Human Agreement | Gold Label(사람 판정)과의 일치율 |

- 케이스별 **PASS / FAIL + 사유(reason)** 기록.
- 이슈 유형별 세분 지표(per-type P/R/F1)도 제공하여 어떤 유형에서 약한지 진단 가능.

### 6.4 Prompt Versioning (프롬프트 버저닝)

```
v1 → Evaluate → Failure Analysis → Improve Prompt → v2 → Evaluate Again → Release
```

- 각 프롬프트 버전은 **평가 결과 스냅샷**과 함께 저장.
- **Failure Analysis**: FAIL 케이스를 이슈 유형·실패 패턴별로 군집화하여 개선 힌트 제공.
- **v1 vs v2 비교 뷰**: 지표 델타(▲/▼), 개선/퇴행(regression) 케이스 명시.
- **Deployment Decision**: 지표 임계값(예: F1 ≥ 0.85, Rule Compliance = 100%) 충족 시 Release 권고.

---

## 7. UI / UX 요구사항

**단일 페이지 애플리케이션 (SPA)** — 4분할 레이아웃.

```
┌───────────────┬─────────────────────────┬──────────────────┐
│  Prompt Editor │   Evaluation Progress   │ Metrics Dashboard │
│    (Left)      │        (Center)         │      (Right)       │
├───────────────┴─────────────────────────┴──────────────────┤
│                    Failure Explorer (Bottom)                 │
└──────────────────────────────────────────────────────────────┘
```

| 영역 | 역할 | 주요 요소 |
|---|---|---|
| Left — Prompt Editor | 프롬프트 편집·버전 선택 | v1/v2 탭, diff, 저장/실행 버튼 |
| Center — Evaluation Progress | 100 케이스 실행 실시간 | 진행바, 케이스별 PASS/FAIL/사유 스트림 |
| Right — Metrics Dashboard | 6대 지표 실시간 | 지표 카드, 혼동행렬, per-type 차트 |
| Bottom — Failure Explorer | 실패 케이스 심층 분석 | 필터(유형별), draft·expected·agent 나란히 보기 |

### UX 원칙
- 지표는 **실시간 갱신** (케이스가 끝날 때마다 업데이트).
- 색상은 **light/dark 테마 모두 지원**, 접근성(대비) 준수.
- 차트는 데이터 시각화 가이드라인을 따름 (일관된 팔레트).

---

## 8. 데모 시나리오 (Demo)

1. **v1 프롬프트로 100 케이스 실행**
2. 실시간으로 PASS / FAIL / 사유가 흐름
3. Metrics Dashboard의 6대 지표가 실시간 갱신
4. Failure Explorer에서 실패 패턴 확인 → **Failure Analysis**
5. 프롬프트를 **v2로 개선**
6. **재실행** 후 v1 vs v2 지표 비교
7. 임계값 충족 시 **Release / Deployment Decision** 시연

**성공 기준(데모)**: v2가 v1 대비 주요 지표(F1, Recall)에서 유의미한 개선을 보이고, 그 개선이 지표로 명확히 설명됨.

---

## 9. 기술 아키텍처 (제안)

| 레이어 | 제안 |
|---|---|
| Frontend | SPA (React 등), 상태 관리로 실시간 스트리밍 반영 |
| Review Agent | Claude API (`claude-opus-4-8` 등), 구조화 출력(툴/JSON 스키마 강제) |
| Evaluation | 결정적 규칙 엔진 (프론트/백 어디든, 재현성 보장) |
| Dataset | 100개 합성 케이스 (JSON 파일/번들) |
| 실시간 갱신 | 케이스 단위 스트리밍(서버 이벤트 또는 클라이언트 배치 루프) |

> 세부 스택(백엔드 유무, 키 보관 방식 등)은 구현 단계에서 확정. 데모 목적상 클라이언트 중심 구성도 가능하나, **API 키 노출 방지**를 위해 경량 백엔드 프록시 권장.

---

## 10. 성공 지표 (Success Metrics)

| 구분 | 기준 |
|---|---|
| 기능 완결성 | 100 케이스 end-to-end 실행 성공 |
| 평가 신뢰성 | 규칙 기반 지표가 재현 가능(동일 입력 → 동일 결과) |
| 개선 시연 | v1→v2 지표 개선을 정량적으로 제시 |
| 교육 효과 | 사용자가 "평가로 신뢰를 만든다"를 이해 |
| Rule Compliance | 에이전트 JSON 출력 규칙 준수율 100% 목표 |

---

## 11. 로드맵 / 마일스톤 (제안)

| 단계 | 산출물 |
|---|---|
| M1 — Dataset | 100개 합성 케이스 + 스키마 확정 |
| M2 — Agent | Claude 리뷰 에이전트 + 구조화 JSON 출력 |
| M3 — Evaluation | 규칙 기반 6대 지표 엔진 |
| M4 — UI | 4분할 SPA + 실시간 갱신 |
| M5 — Versioning | v1/v2 비교, Failure Explorer |
| M6 — Demo | 시연 시나리오 + 배포 결정 뷰 |

---

## 12. 리스크 & 대응

| 리스크 | 대응 |
|---|---|
| LLM 출력이 스키마를 어김 | 툴/JSON 스키마 강제 + 재시도, Rule Compliance로 계측 |
| 합성 데이터 편향 | 이슈 유형·난이도 균형 설계, per-type 지표로 감시 |
| 규칙 매칭의 모호함(부분 일치) | 매칭 기준(유형 단위 vs 상세 단위) 명문화 |
| API 키 노출 | 백엔드 프록시로 키 은닉 |
| "생성 품질"로 목표가 흐려짐 | 문서·UI에서 "평가가 목적"임을 반복 강조 |

---

## 13. 교육적 메시지 (Educational Message)

> **LLM은 모델이다. 모델은 검증을 요구한다.**
> **프롬프트를 믿지 마라. 평가를 믿어라.**

이 앱의 최종 목적은 뛰어난 편차 리포트가 아니라, **"AI를 어떻게 신뢰 가능하게 만드는가"**를 보여주는 것이다.

---

## 부록 A — 6대 지표 계산 정의

이슈 유형별로 (에이전트 지적 여부) vs (Gold Label)을 TP/FP/FN/TN으로 집계:

- **TP**: 실제 이슈를 에이전트도 지적
- **FP**: 이슈가 없는데 에이전트가 지적
- **FN**: 실제 이슈를 에이전트가 놓침
- **TN**: 이슈 없음 + 에이전트도 지적 안 함

```
Accuracy  = (TP + TN) / (TP + TN + FP + FN)
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2 · (Precision · Recall) / (Precision + Recall)
Rule Compliance = (스키마·규칙 준수 출력 수) / (전체 출력 수)
Human Agreement = (Gold Label과 일치한 판정 수) / (전체 판정 수)
```

Micro/Macro 평균을 모두 제공하여 전체 성능과 유형별 균형을 함께 진단.
