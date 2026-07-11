"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CaseEvaluation,
  GoldLabels,
  IssueType,
  ISSUE_LABELS,
  ISSUE_TYPES,
  Metrics,
} from "@/lib/types";
import { DEFAULT_PROMPTS } from "@/lib/prompts";

type PromptId = "v1" | "v2";

interface CaseRow {
  id: string;
  difficulty?: string;
  draft?: string;
  gold_labels?: GoldLabels;
  expected_issues?: { type: IssueType; detail: string }[];
  evaluation: CaseEvaluation;
  source?: string;
}

interface RunResult {
  status: "idle" | "running" | "done";
  total: number;
  done: number;
  mode: string;
  cases: CaseRow[];
  metrics: Metrics | null;
}

const emptyRun = (): RunResult => ({
  status: "idle",
  total: 0,
  done: 0,
  mode: "mock",
  cases: [],
  metrics: null,
});

const pct = (n: number | undefined) =>
  n === undefined ? "—" : `${(n * 100).toFixed(1)}%`;

// 이슈 유형 → DS 역할 액센트 슬롯 (색은 토큰이 테마별로 해결).
const TYPE_COLORS: Record<IssueType, string> = {
  missing_5whys: "var(--ds-accent-1)",
  weak_root_cause: "var(--ds-accent-2)",
  missing_capa: "var(--ds-accent-3)",
  unsupported_claims: "var(--ds-accent-4)",
  logical_issues: "var(--ds-info)",
};
const TYPE_BG: Record<IssueType, string> = {
  missing_5whys: "var(--ds-accent-1-bg)",
  weak_root_cause: "var(--ds-accent-2-bg)",
  missing_capa: "var(--ds-accent-3-bg)",
  unsupported_claims: "var(--ds-accent-4-bg)",
  logical_issues: "var(--ds-info-bg)",
};

export default function Page() {
  const [prompts, setPrompts] = useState<Record<PromptId, string>>({
    v1: DEFAULT_PROMPTS.v1.system,
    v2: DEFAULT_PROMPTS.v2.system,
  });
  const [active, setActive] = useState<PromptId>("v1");
  const [runs, setRuns] = useState<Record<PromptId, RunResult>>({
    v1: emptyRun(),
    v2: emptyRun(),
  });
  const [mode, setMode] = useState<string>("mock");
  const [limit, setLimit] = useState<number>(100);
  const [selected, setSelected] = useState<string | null>(null);
  const [failFilter, setFailFilter] = useState<IssueType | "all">("all");
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [forceMock, setForceMock] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/dataset")
      .then((r) => r.json())
      .then((d) => setMode(d.mode))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    if (theme === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", theme);
  }, [theme]);

  const cycleTheme = () =>
    setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  const themeIcon = theme === "system" ? "◐" : theme === "light" ? "☀" : "☾";
  const themeLabel = theme.charAt(0).toUpperCase() + theme.slice(1);

  const running = runs[active].status === "running";

  async function runEvaluation() {
    if (running) return;
    setSelected(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setRuns((r) => ({ ...r, [active]: { ...emptyRun(), status: "running" } }));

    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: prompts[active],
        promptId: active,
        limit,
        useMock: forceMock || undefined,
      }),
      signal: controller.signal,
    });
    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handle = (event: string, data: any) => {
      if (event === "meta") {
        setRuns((r) => ({
          ...r,
          [active]: { ...r[active], total: data.total, mode: data.mode, status: "running" },
        }));
        setMode(data.mode);
      } else if (event === "case") {
        setRuns((r) => {
          const run = r[active];
          const row: CaseRow = {
            id: data.case.id,
            difficulty: data.case.difficulty,
            draft: data.case.draft,
            gold_labels: data.case.gold_labels,
            expected_issues: data.case.expected_issues,
            evaluation: data.evaluation,
            source: data.source,
          };
          return { ...r, [active]: { ...run, done: data.done, cases: [...run.cases, row] } };
        });
      } else if (event === "done") {
        setRuns((r) => ({
          ...r,
          [active]: { ...r[active], status: "done", metrics: data.metrics },
        }));
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const lines = chunk.split("\n");
          const ev = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
          const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (ev && dataLine) handle(ev, JSON.parse(dataLine));
        }
      }
    } catch {
      /* aborted */
    }
  }

  const run = runs[active];
  const other = active === "v1" ? runs.v2 : runs.v1;
  const metrics = run.metrics;
  const otherMetrics = other.metrics;

  const failedCases = useMemo(
    () =>
      run.cases.filter(
        (c) =>
          !c.evaluation.pass &&
          (failFilter === "all" ||
            c.evaluation.perType?.[failFilter as IssueType]?.outcome === "FP" ||
            c.evaluation.perType?.[failFilter as IssueType]?.outcome === "FN")
      ),
    [run.cases, failFilter]
  );

  const selectedCase = run.cases.find((c) => c.id === selected) || null;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div>
            <span className="eyebrow">Golden Batch × Deviation Review · Evaluation Lab</span>
            <h1>
              프롬프트를 믿지 말고 <span className="blue">평가</span>를 믿어라
            </h1>
            <div className="tag">
              LLM은 모델이다 · 모델은 검증을 요구한다 — 편차 리뷰 에이전트를 배포 전 정량 검증합니다.
            </div>
          </div>
          <div className="header-right">
            <span className={`badge ${forceMock || mode === "mock" ? "mock" : ""}`}>
              <span className="dot" />
              {forceMock
                ? "MOCK (강제)"
                : mode === "mock"
                ? "MOCK (API 키 없음)"
                : "Claude 실행"}
            </span>
            <button
              className="toggle"
              type="button"
              onClick={cycleTheme}
              aria-label="테마 전환"
            >
              <span>{themeIcon}</span>
              <span>{themeLabel}</span>
            </button>
          </div>
        </div>
      </header>

      {/* LEFT — Prompt Editor */}
      <section className="left panel">
        <div className="panel-head">
          Prompt Editor <span className="sub">좌 · 프롬프트 버전</span>
        </div>
        <div className="panel-body" style={{ display: "flex", flexDirection: "column" }}>
          <div className="tabs">
            {(["v1", "v2"] as PromptId[]).map((id) => (
              <button
                key={id}
                className={`tab ${active === id ? "active" : ""}`}
                onClick={() => setActive(id)}
              >
                {DEFAULT_PROMPTS[id].label}
                {runs[id].metrics && (
                  <span style={{ marginLeft: 6, opacity: 0.8 }}>
                    F1 {pct(runs[id].metrics!.f1)}
                  </span>
                )}
              </button>
            ))}
          </div>
          <textarea
            className="prompt"
            value={prompts[active]}
            onChange={(e) => setPrompts((p) => ({ ...p, [active]: e.target.value }))}
            spellCheck={false}
          />
          <div className="controls">
            <div className="row">
              <label className="hint">케이스 수</label>
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                <option value={20}>20 (빠른 데모)</option>
                <option value={50}>50</option>
                <option value={100}>100 (전체)</option>
              </select>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  setPrompts((p) => ({ ...p, [active]: DEFAULT_PROMPTS[active].system }))
                }
              >
                초기화
              </button>
            </div>
            <label className="row" style={{ cursor: "pointer", gap: 8 }}>
              <input
                type="checkbox"
                checked={forceMock}
                onChange={(e) => setForceMock(e.target.checked)}
              />
              <span className="hint">
                Mock 모드로 실행 (API 비용 없음 · 크레딧 부족 시 사용)
              </span>
            </label>
            <button className="btn btn-primary" onClick={runEvaluation} disabled={running}>
              {running ? `실행 중… ${run.done}/${run.total}` : `▶ ${active.toUpperCase()} 평가 실행`}
            </button>
            <div className="hint">
              {forceMock || mode === "mock"
                ? "결정적 Mock 리뷰어로 실행됩니다. v1은 의도적으로 노이즈가 있어 v2보다 지표가 낮습니다."
                : "Claude가 각 초안을 구조화 JSON으로 리뷰합니다. (Anthropic 크레딧 필요)"}
            </div>
          </div>
        </div>
      </section>

      {/* CENTER — Evaluation Progress */}
      <section className="center panel">
        <div className="panel-head">
          Evaluation Progress <span className="sub">중 · 실시간 PASS / FAIL</span>
        </div>
        <div className="panel-body">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: run.total ? `${(run.done / run.total) * 100}%` : "0%" }}
            />
          </div>
          <div className="progress-meta">
            <span>
              {run.done} / {run.total || "—"} 케이스
            </span>
            <span>
              PASS {run.cases.filter((c) => c.evaluation.pass).length} · FAIL{" "}
              {run.cases.filter((c) => !c.evaluation.pass).length}
            </span>
          </div>
          <div className="case-list">
            {run.cases.length === 0 && (
              <div className="empty">평가를 실행하면 케이스별 결과가 실시간으로 표시됩니다.</div>
            )}
            {run.cases.map((c) => (
              <div key={c.id} className="case-row" onClick={() => setSelected(c.id)}>
                <span className="cid">{c.id}</span>
                <span className={`pill ${c.evaluation.pass ? "pass" : "fail"}`}>
                  {c.evaluation.pass ? "PASS" : "FAIL"}
                </span>
                <span className="reason">{c.evaluation.reason}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RIGHT — Metrics Dashboard */}
      <section className="right panel">
        <div className="panel-head">
          Metrics Dashboard <span className="sub">우 · 6대 지표</span>
        </div>
        <div className="panel-body">
          <MetricGrid metrics={metrics} other={otherMetrics} otherLabel={active === "v1" ? "v2" : "v1"} />

          <div className="section-title">혼동행렬 (유형 단위 · Micro)</div>
          <div className="confusion">
            <Cell k="TP (정탐)" v={metrics?.confusion.tp} cls="tp" />
            <Cell k="FP (오탐)" v={metrics?.confusion.fp} cls="fp" />
            <Cell k="FN (누락)" v={metrics?.confusion.fn} cls="fn" />
            <Cell k="TN (정상)" v={metrics?.confusion.tn} cls="tn" />
          </div>

          <div className="section-title">유형별 F1</div>
          {ISSUE_TYPES.map((t) => (
            <div className="bar-row" key={t}>
              <span style={{ color: TYPE_COLORS[t] }}>{ISSUE_LABELS[t]}</span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${(metrics?.perType[t].f1 ?? 0) * 100}%`,
                    background: TYPE_COLORS[t],
                  }}
                />
              </div>
              <span className="bar-val">{metrics ? pct(metrics.perType[t].f1) : "—"}</span>
            </div>
          ))}

          <div className="section-title">배포 결정</div>
          <DeploymentDecision metrics={metrics} />
        </div>
      </section>

      {/* BOTTOM — Failure Explorer */}
      <section className="bottom panel">
        <div className="panel-head">
          Failure Explorer <span className="sub">하 · 실패 케이스 심층 분석</span>
        </div>
        <div className="panel-body" style={{ height: "100%" }}>
          <div className="explorer">
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div className="fail-filters">
                <span
                  className={`chip ${failFilter === "all" ? "active" : ""}`}
                  onClick={() => setFailFilter("all")}
                >
                  전체 실패 ({run.cases.filter((c) => !c.evaluation.pass).length})
                </span>
                {ISSUE_TYPES.map((t) => (
                  <span
                    key={t}
                    className={`chip ${failFilter === t ? "active" : ""}`}
                    onClick={() => setFailFilter(t)}
                  >
                    {ISSUE_LABELS[t]}
                  </span>
                ))}
              </div>
              <div className="fail-list">
                {failedCases.length === 0 && (
                  <div className="empty">해당 조건의 실패 케이스가 없습니다.</div>
                )}
                {failedCases.map((c) => (
                  <div key={c.id} className="case-row" onClick={() => setSelected(c.id)}>
                    <span className="cid">{c.id}</span>
                    <span className="pill fail">FAIL</span>
                    <span className="reason">{c.evaluation.reason}</span>
                  </div>
                ))}
              </div>
            </div>
            <FailureDetail c={selectedCase} />
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricGrid({
  metrics,
  other,
  otherLabel,
}: {
  metrics: Metrics | null;
  other: Metrics | null;
  otherLabel: string;
}) {
  const items: { label: string; key: keyof Metrics }[] = [
    { label: "Accuracy", key: "accuracy" },
    { label: "Precision", key: "precision" },
    { label: "Recall", key: "recall" },
    { label: "F1", key: "f1" },
    { label: "Rule Compliance", key: "ruleCompliance" },
    { label: "Human Agreement", key: "humanAgreement" },
  ];
  return (
    <div className="metric-grid">
      {items.map(({ label, key }) => {
        const v = metrics ? (metrics[key] as number) : undefined;
        const ov = other ? (other[key] as number) : undefined;
        const delta = v !== undefined && ov !== undefined ? v - ov : undefined;
        return (
          <div className="metric" key={label}>
            <div className="label">{label}</div>
            <div className="val">
              {pct(v)}
              {delta !== undefined && Math.abs(delta) > 0.0001 && (
                <span className={`delta ${delta > 0 ? "up" : "down"}`}>
                  {delta > 0 ? "▲" : "▼"}
                  {Math.abs(delta * 100).toFixed(1)}
                </span>
              )}
            </div>
            {delta !== undefined && (
              <div className="hint">vs {otherLabel} 기준</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Cell({ k, v, cls }: { k: string; v: number | undefined; cls: string }) {
  return (
    <div className={`cell ${cls}`}>
      <span className="k">{k}</span>
      <span className="v">{v ?? "—"}</span>
    </div>
  );
}

function DeploymentDecision({ metrics }: { metrics: Metrics | null }) {
  if (!metrics) return <div className="hint">평가 완료 후 판단됩니다.</div>;
  const ok = metrics.f1 >= 0.85 && metrics.ruleCompliance >= 0.999;
  const tone = ok ? "var(--ds-success)" : "var(--ds-warning)";
  const toneBg = ok ? "var(--ds-success-bg)" : "var(--ds-warning-bg)";
  return (
    <div className="metric" style={{ borderColor: tone, background: toneBg }}>
      <div
        className="val"
        style={{ fontSize: "var(--ds-text-lg)", color: tone, fontFamily: "var(--ds-font-sans)" }}
      >
        {ok ? "✅ Release 권고" : "⚠ 개선 필요"}
      </div>
      <div className="hint">
        기준: F1 ≥ 85% · Rule Compliance = 100% (현재 F1 {pct(metrics.f1)} · RC{" "}
        {pct(metrics.ruleCompliance)})
      </div>
    </div>
  );
}

function FailureDetail({ c }: { c: CaseRow | null }) {
  if (!c) return <div className="empty">케이스를 선택하면 초안·정답·에이전트 판정을 비교합니다.</div>;
  const gold = c.gold_labels;
  const predicted = c.evaluation.agentOutput?.issues.map((i) => i.type) || [];
  return (
    <div className="detail">
      <div className="draft mono">{c.draft}</div>
      <div className="col">
        <h4>정답(Gold) · 기대 이슈</h4>
        {ISSUE_TYPES.filter((t) => gold?.[t]).length === 0 && (
          <div className="hint">결함 없음 (모든 유형 정상)</div>
        )}
        {ISSUE_TYPES.filter((t) => gold?.[t]).map((t) => (
          <div className="issue-item" key={t} style={{ borderLeftColor: TYPE_COLORS[t] }}>
            <span
              className="type-tag"
              style={{ background: TYPE_BG[t], color: TYPE_COLORS[t] }}
            >
              {ISSUE_LABELS[t]}
            </span>
            <div>{c.expected_issues?.find((e) => e.type === t)?.detail}</div>
          </div>
        ))}
      </div>
      <div className="col">
        <h4>에이전트 판정</h4>
        {predicted.length === 0 && <div className="hint">지적한 이슈 없음</div>}
        {c.evaluation.agentOutput?.issues.map((i, idx) => {
          const oc = c.evaluation.perType?.[i.type]?.outcome;
          const isFP = oc === "FP";
          return (
            <div
              className="issue-item"
              key={idx}
              style={{ borderLeftColor: isFP ? "var(--ds-danger)" : TYPE_COLORS[i.type] }}
            >
              <span
                className="type-tag"
                style={{
                  background: isFP ? "var(--ds-danger-bg)" : TYPE_BG[i.type],
                  color: isFP ? "var(--ds-danger)" : TYPE_COLORS[i.type],
                }}
              >
                {ISSUE_LABELS[i.type]} {isFP ? "· 오탐(FP)" : ""}
              </span>
              <div>{i.explanation}</div>
            </div>
          );
        })}
        {ISSUE_TYPES.filter((t) => gold?.[t] && !predicted.includes(t)).map((t) => (
          <div className="issue-item" key={`fn-${t}`} style={{ borderLeftColor: "var(--ds-warning)" }}>
            <span
              className="type-tag"
              style={{ background: "var(--ds-warning-bg)", color: "var(--ds-warning)" }}
            >
              {ISSUE_LABELS[t]} · 누락(FN)
            </span>
            <div>에이전트가 이 실제 이슈를 놓쳤습니다.</div>
          </div>
        ))}
      </div>
    </div>
  );
}
