"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CaseEvaluation,
  GoldLabels,
  IssueType,
  ISSUE_LABELS,
  ISSUE_TYPES,
  Metrics,
} from "@/lib/types";
import { DEFAULT_PROMPTS } from "@/lib/prompts";
import { saveConfirmed, loadConfirmed } from "@/lib/confirmed";
import { DocumentViewer } from "./components/DocumentViewer";

type PromptId = "v1" | "v2";

interface CaseRow {
  id: string;
  difficulty?: string;
  draft?: string;
  gold_labels?: GoldLabels;
  expected_issues?: { type: IssueType; detail: string }[];
  evaluation: CaseEvaluation;
}
interface RunResult {
  status: "idle" | "running" | "done";
  total: number;
  done: number;
  cases: CaseRow[];
  metrics: Metrics | null;
}
const emptyRun = (): RunResult => ({ status: "idle", total: 0, done: 0, cases: [], metrics: null });
const pct = (n: number | undefined) => (n === undefined ? "—" : `${(n * 100).toFixed(1)}%`);

const TYPE_COLORS: Record<IssueType, string> = {
  missing_5whys: "var(--ds-accent-1)",
  weak_root_cause: "var(--ds-accent-2)",
  missing_capa: "var(--ds-accent-3)",
  unsupported_claims: "var(--ds-accent-4)",
  logical_issues: "var(--ds-info)",
};

export default function LabPage() {
  const [prompts, setPrompts] = useState<Record<PromptId, string>>({
    v1: DEFAULT_PROMPTS.v1.system,
    v2: DEFAULT_PROMPTS.v2.system,
  });
  const [active, setActive] = useState<PromptId>("v1");
  const [runs, setRuns] = useState<Record<PromptId, RunResult>>({ v1: emptyRun(), v2: emptyRun() });
  const [mode, setMode] = useState("mock");
  const [forceMock, setForceMock] = useState(false);
  const [limit, setLimit] = useState(100);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState<PromptId>("v1");
  const [confirmedId, setConfirmedId] = useState<string>("v2");

  useEffect(() => {
    fetch("/api/dataset").then((r) => r.json()).then((d) => setMode(d.mode)).catch(() => {});
    setConfirmedId(loadConfirmed().versionId);
  }, []);

  const run = runs[active];
  const other = active === "v1" ? runs.v2 : runs.v1;
  const running = run.status === "running";

  async function runEvaluation() {
    if (running) return;
    setSelected(null);
    setRuns((r) => ({ ...r, [active]: { ...emptyRun(), status: "running" } }));
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: prompts[active], promptId: active, limit, useMock: forceMock || undefined }),
    });
    if (!res.body) return;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const handle = (ev: string, data: any) => {
      if (ev === "meta") {
        setMode(data.mode);
        setRuns((r) => ({ ...r, [active]: { ...r[active], total: data.total, status: "running" } }));
      } else if (ev === "case") {
        setRuns((r) => {
          const cur = r[active];
          const row: CaseRow = { ...data.case, evaluation: data.evaluation };
          return { ...r, [active]: { ...cur, done: data.done, cases: [...cur.cases, row] } };
        });
      } else if (ev === "done") {
        setRuns((r) => ({ ...r, [active]: { ...r[active], status: "done", metrics: data.metrics } }));
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const p of parts) {
        const lines = p.split("\n");
        const ev = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
        const dl = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
        if (ev && dl) handle(ev, JSON.parse(dl));
      }
    }
  }

  function deploy(id: PromptId) {
    const m = runs[id].metrics;
    saveConfirmed({
      versionId: id,
      label: DEFAULT_PROMPTS[id].label,
      system: prompts[id],
      f1: m?.f1,
      at: "deployed",
    });
    setConfirmedId(id);
  }

  const metrics = run.metrics;
  const otherMetrics = other.metrics;
  const selectedCase = run.cases.find((c) => c.id === selected) || null;
  const isMock = forceMock || mode === "mock";

  return (
    <div className="page">
      <div className="page-head">
        <span className="eyebrow" style={{ color: "var(--ds-brand)" }}>
          운영 화면 · 프롬프트 엔지니어링 & 검증
        </span>
        <h1>
          정답지 100건으로 <span className="blue">프롬프트를 검증</span>하고 배포한다
        </h1>
        <div className="tag">
          프롬프트를 고쳐 채점 → 지표가 좋아지면 "이 버전 배포" → 리뷰어 화면에 반영됩니다.
        </div>
      </div>

      {/* Run bar */}
      <div className="runbar" style={{ marginBottom: 16 }}>
        <div className="verpick">
          {(["v1", "v2"] as PromptId[]).map((id) => (
            <button
              key={id}
              className={`verchip ${active === id ? "active" : ""}`}
              onClick={() => setActive(id)}
            >
              {DEFAULT_PROMPTS[id].label}
              {runs[id].metrics && <span className="f1">F1 {pct(runs[id].metrics!.f1)}</span>}
              {confirmedId === id && <span className="f1">· 배포됨</span>}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={() => { setDrawerTab(active); setDrawer(true); }}>
          ✎ 프롬프트 편집
        </button>
        <div className="spacer" />
        <label className="checkline hint">
          <input type="checkbox" checked={forceMock} onChange={(e) => setForceMock(e.target.checked)} />
          Mock (비용 없음)
        </label>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={20}>20건</option>
          <option value={50}>50건</option>
          <option value={100}>100건</option>
        </select>
        <button className="btn btn-primary" onClick={runEvaluation} disabled={running}>
          {running ? `채점 중… ${run.done}/${run.total}` : `▶ ${active.toUpperCase()} 채점 실행`}
        </button>
        <button
          className="btn btn-secondary"
          disabled={!metrics}
          onClick={() => deploy(active)}
          title="이 버전을 리뷰어 화면에 배포"
        >
          ⬆ 이 버전 배포
        </button>
      </div>

      <div className="lab">
        <div className="lab-main">
          {/* Punchy summary */}
          <SummaryHero metrics={metrics} other={otherMetrics} otherLabel={active === "v1" ? "v2" : "v1"} />

          {/* Case results */}
          <div className="panel">
            <div className="panel-head">
              평가 진행 · PASS / FAIL <span className="sub">케이스를 누르면 원문에서 상세 확인</span>
            </div>
            <div className="panel-body" style={{ maxHeight: "48vh" }}>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: run.total ? `${(run.done / run.total) * 100}%` : "0%" }} />
              </div>
              <div className="progress-meta">
                <span>{run.done} / {run.total || "—"} 케이스</span>
                <span>PASS {run.cases.filter((c) => c.evaluation.pass).length} · FAIL {run.cases.filter((c) => !c.evaluation.pass).length}</span>
              </div>
              <div className="case-list">
                {run.cases.length === 0 && <div className="empty">채점을 실행하면 케이스별 결과가 실시간으로 표시됩니다.</div>}
                {run.cases.map((c) => (
                  <div key={c.id} className="case-row" onClick={() => setSelected(c.id)}>
                    <span className="cid">{c.id}</span>
                    <span className={`pill ${c.evaluation.pass ? "pass" : "fail"}`}>{c.evaluation.pass ? "PASS" : "FAIL"}</span>
                    <span className="reason">{c.evaluation.reason}</span>
                    <span className="chev">상세 ›</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Metrics rail */}
        <MetricsRail metrics={metrics} other={otherMetrics} otherLabel={active === "v1" ? "v2" : "v1"} />
      </div>

      {drawer && (
        <PromptDrawer
          prompts={prompts}
          setPrompts={setPrompts}
          tab={drawerTab}
          setTab={setDrawerTab}
          runs={runs}
          onClose={() => setDrawer(false)}
        />
      )}

      {selectedCase && (
        <CaseModal c={selectedCase} isMock={isMock} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function SummaryHero({ metrics, other, otherLabel }: { metrics: Metrics | null; other: Metrics | null; otherLabel: string }) {
  const items: { k: string; key: keyof Metrics; hero?: boolean }[] = [
    { k: "F1 Score", key: "f1", hero: true },
    { k: "Precision", key: "precision" },
    { k: "Recall", key: "recall" },
    { k: "Rule Compliance", key: "ruleCompliance" },
  ];
  return (
    <div className="summary">
      {items.map(({ k, key, hero }) => {
        const v = metrics ? (metrics[key] as number) : undefined;
        const ov = other ? (other[key] as number) : undefined;
        const d = v !== undefined && ov !== undefined ? v - ov : undefined;
        return (
          <div className={`stat ${hero ? "hero-pass" : ""}`} key={k}>
            <div className="k">{k}</div>
            <div className="v">{pct(v)}</div>
            {d !== undefined ? (
              <div className={`d ${Math.abs(d) < 0.0001 ? "flat" : d > 0 ? "up" : "down"}`}>
                {Math.abs(d) < 0.0001 ? "동일" : `${d > 0 ? "▲" : "▼"} ${Math.abs(d * 100).toFixed(1)}p vs ${otherLabel}`}
              </div>
            ) : (
              <div className="d flat">{metrics ? "단독 실행" : "채점 대기"}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MetricsRail({ metrics, other, otherLabel }: { metrics: Metrics | null; other: Metrics | null; otherLabel: string }) {
  const ok = metrics && metrics.f1 >= 0.85 && metrics.ruleCompliance >= 0.999;
  const tone = ok ? "var(--ds-success)" : "var(--ds-warning)";
  return (
    <div className="panel">
      <div className="panel-head">Metrics Dashboard <span className="sub">6대 지표 · 혼동행렬</span></div>
      <div className="panel-body">
        {([
          ["accuracy", "Accuracy"],
          ["precision", "Precision"],
          ["recall", "Recall"],
          ["humanAgreement", "Human Agreement"],
        ] as [keyof Metrics, string][]).map(([key, label]) => {
          const v = metrics ? (metrics[key] as number) : undefined;
          const ov = other ? (other[key] as number) : undefined;
          const d = v !== undefined && ov !== undefined ? v - ov : undefined;
          return (
            <div className="metric-line" key={key}>
              <span className="l">{label}</span>
              <span className="v">
                {pct(v)}
                {d !== undefined && Math.abs(d) > 0.0001 && (
                  <span className={`delta ${d > 0 ? "up" : "down"}`}>{d > 0 ? "▲" : "▼"}{Math.abs(d * 100).toFixed(1)}</span>
                )}
              </span>
            </div>
          );
        })}

        <div className="section-title">혼동행렬 (유형 단위 · Micro)</div>
        <div className="confusion">
          <div className="cell tp"><span className="k">TP 정탐</span><span className="v">{metrics?.confusion.tp ?? "—"}</span></div>
          <div className="cell fp"><span className="k">FP 오탐</span><span className="v">{metrics?.confusion.fp ?? "—"}</span></div>
          <div className="cell fn"><span className="k">FN 누락</span><span className="v">{metrics?.confusion.fn ?? "—"}</span></div>
          <div className="cell tn"><span className="k">TN 정상</span><span className="v">{metrics?.confusion.tn ?? "—"}</span></div>
        </div>

        <div className="section-title">유형별 F1</div>
        {ISSUE_TYPES.map((t) => (
          <div className="bar-row" key={t}>
            <span style={{ color: TYPE_COLORS[t] }}>{ISSUE_LABELS[t]}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(metrics?.perType[t].f1 ?? 0) * 100}%`, background: TYPE_COLORS[t] }} />
            </div>
            <span className="bar-val">{metrics ? pct(metrics.perType[t].f1) : "—"}</span>
          </div>
        ))}

        <div className="section-title">배포 결정</div>
        <div className="deploy" style={{ borderColor: tone, background: metrics ? (ok ? "var(--ds-success-bg)" : "var(--ds-warning-bg)") : "var(--ds-surface-2)" }}>
          {metrics ? (
            <>
              <div className="h" style={{ color: tone }}>{ok ? "✅ Release 권고" : "⚠ 개선 필요"}</div>
              <div className="hint">기준 F1 ≥ 85% · RC = 100% (현재 F1 {pct(metrics.f1)} · RC {pct(metrics.ruleCompliance)})</div>
            </>
          ) : (
            <div className="hint">채점 완료 후 판단됩니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function PromptDrawer({
  prompts, setPrompts, tab, setTab, runs, onClose,
}: {
  prompts: Record<PromptId, string>;
  setPrompts: React.Dispatch<React.SetStateAction<Record<PromptId, string>>>;
  tab: PromptId;
  setTab: (t: PromptId) => void;
  runs: Record<PromptId, RunResult>;
  onClose: () => void;
}) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <h3>프롬프트 편집 & 버전</h3>
          <button className="iconbtn" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">
          <div className="tabs">
            {(["v1", "v2"] as PromptId[]).map((id) => (
              <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
                {DEFAULT_PROMPTS[id].label}
              </button>
            ))}
          </div>
          <textarea
            className="prompt"
            value={prompts[tab]}
            onChange={(e) => setPrompts((p) => ({ ...p, [tab]: e.target.value }))}
            spellCheck={false}
          />
          <button className="btn btn-secondary" onClick={() => setPrompts((p) => ({ ...p, [tab]: DEFAULT_PROMPTS[tab].system }))}>
            기본값으로 초기화
          </button>
          <div className="section-title" style={{ marginTop: 8 }}>버전 이력 (최근 채점)</div>
          <div className="history">
            {(["v1", "v2"] as PromptId[]).map((id) => (
              <div className="history-item" key={id}>
                <span>{DEFAULT_PROMPTS[id].label}</span>
                <span className="meta">
                  {runs[id].metrics
                    ? `F1 ${pct(runs[id].metrics!.f1)} · PASS ${runs[id].metrics!.passed}/${runs[id].metrics!.total}`
                    : "미실행"}
                </span>
              </div>
            ))}
          </div>
          <div className="hint">편집 후 드로어를 닫고 해당 버전을 채점하면 지표가 갱신됩니다.</div>
        </div>
        <div className="drawer-foot">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onClose}>완료</button>
        </div>
      </aside>
    </>
  );
}

function CaseModal({ c, isMock, onClose }: { c: CaseRow; isMock: boolean; onClose: () => void }) {
  return (
    <div className="modal-wrap">
      <div className="scrim" onClick={onClose} />
      <div className="modal-card">
        <div className="modal-head">
          <span className="t">
            {c.id} · 원문 상세{" "}
            <span className="hint" style={{ fontWeight: 400 }}>
              {isMock ? "Mock" : "Claude"} 리뷰 · 정탐/오탐/놓침을 우측 메모로 표시
            </span>
          </span>
          <button className="iconbtn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-scroll">
          <DocumentViewer
            draft={c.draft || ""}
            agent={c.evaluation.agentOutput}
            gold={c.gold_labels}
            title={`편차 리포트 ${c.id} · 정답 대비 채점`}
          />
        </div>
      </div>
    </div>
  );
}
