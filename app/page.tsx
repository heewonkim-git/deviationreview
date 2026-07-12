"use client";

import { useEffect, useState } from "react";
import {
  CaseEvaluation,
  GoldLabels,
  IssueType,
  ISSUE_LABELS,
  ISSUE_TYPES,
  Metrics,
} from "@/lib/types";
import { DEFAULT_PROMPTS } from "@/lib/prompts";
import { aggregateMetrics } from "@/lib/evaluate";
import { saveConfirmed, loadConfirmed } from "@/lib/confirmed";
import { DocumentViewer } from "./components/DocumentViewer";
import { Icon } from "./components/Icon";

interface CaseRow {
  id: string;
  difficulty?: string;
  draft?: string;
  gold_labels?: GoldLabels;
  expected_issues?: { type: IssueType; detail: string }[];
  evaluation: CaseEvaluation;
}
interface Version {
  id: number;
  system: string;
  base?: number;
  createdAt: number | null; // ms — 하이드레이션 회피 위해 마운트 후 채움
  status: "idle" | "running" | "done";
  total: number;
  done: number;
  cases: CaseRow[];
  metrics: Metrics | null;
}
const pct = (n: number | undefined) => (n === undefined ? "—" : `${(n * 100).toFixed(1)}%`);
const newVersion = (id: number, system: string, base?: number, createdAt: number | null = null): Version => ({
  id, system, base, createdAt, status: "idle", total: 0, done: 0, cases: [], metrics: null,
});
function fmtTime(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function OperationPage() {
  const [versions, setVersions] = useState<Version[]>([
    newVersion(1, DEFAULT_PROMPTS.v1.system),
    newVersion(2, DEFAULT_PROMPTS.v2.system, 1),
  ]);
  const [selectedId, setSelectedId] = useState(2);
  const [deployedId, setDeployedId] = useState<number | null>(null);
  const [mode, setMode] = useState("mock");
  const [limit, setLimit] = useState(20);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);

  // 개선 드로어
  const [improveOpen, setImproveOpen] = useState(false);
  const [improveBase, setImproveBase] = useState(2);
  const [improveText, setImproveText] = useState("");

  useEffect(() => {
    fetch("/api/dataset").then((r) => r.json()).then((d) => setMode(d.mode)).catch(() => {});
    const c = loadConfirmed();
    if (c.at === "deployed") setDeployedId(c.version);
    // 초기 버전들에 생성시각 부여 (마운트 후 → SSR 하이드레이션 회피)
    const now = Date.now();
    setVersions((vs) => vs.map((v, i) => (v.createdAt == null ? { ...v, createdAt: now - (vs.length - 1 - i) * 3600_000 } : v)));
  }, []);

  const sel = versions.find((v) => v.id === selectedId)!;
  const cmp = versions.find((v) => v.id === (sel.base ?? sel.id - 1));
  const metrics = sel.metrics;
  const cmpMetrics = cmp?.metrics ?? null;
  const running = sel.status === "running";
  const maxId = Math.max(...versions.map((v) => v.id));

  function patch(id: number, fn: (v: Version) => Version) {
    setVersions((vs) => vs.map((v) => (v.id === id ? fn(v) : v)));
  }

  async function runEvaluation() {
    if (running) return;
    const id = selectedId;
    const system = sel.system;
    setSelectedCase(null);
    patch(id, (v) => ({ ...v, status: "running", total: 0, done: 0, cases: [], metrics: null }));
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, promptId: id === 1 ? "v1" : "v2", limit }),
    });
    if (!res.body) return;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const collected: CaseEvaluation[] = [];
    let gotDone = false;
    const handle = (ev: string, data: any) => {
      if (ev === "meta") {
        setMode(data.mode);
        patch(id, (v) => ({ ...v, total: data.total }));
      } else if (ev === "case") {
        collected.push(data.evaluation);
        patch(id, (v) => ({ ...v, done: data.done, cases: [...v.cases, { ...data.case, evaluation: data.evaluation }] }));
      } else if (ev === "done") {
        gotDone = true;
        patch(id, (v) => ({ ...v, status: "done", metrics: data.metrics }));
      }
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const p of parts) {
          const lines = p.split("\n");
          const e = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
          const dl = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (e && dl) handle(e, JSON.parse(dl));
        }
      }
    } catch {
      /* 중단 — 부분 집계 */
    }
    if (!gotDone) {
      const m = collected.length ? aggregateMetrics(collected) : null;
      patch(id, (v) => ({ ...v, status: "done", metrics: m }));
    }
  }

  function openImprove() {
    setImproveBase(selectedId);
    setImproveText(sel.system);
    setImproveOpen(true);
  }
  function saveImprove() {
    const id = maxId + 1;
    setVersions((vs) => [...vs, newVersion(id, improveText, improveBase, Date.now())]);
    setSelectedId(id);
    setImproveOpen(false);
  }
  function deploy() {
    saveConfirmed({
      versionId: `v${sel.id}`,
      version: sel.id,
      label: `v${sel.id}`,
      system: sel.system,
      f1: sel.metrics?.f1,
      at: "deployed",
    });
    setDeployedId(sel.id);
  }

  const deployDisabled = running || selectedId === deployedId || !sel.metrics;
  const deployEnabled = !deployDisabled;
  const caseObj = sel.cases.find((c) => c.id === selectedCase) || null;

  return (
    <div className="page">
      {/* Version bar */}
      <div className="runbar" style={{ marginBottom: 16 }}>
        <label className="verlabel">Prompt :</label>
        <select className="verselect" value={selectedId} onChange={(e) => setSelectedId(Number(e.target.value))}>
          {[...versions].sort((a, b) => b.id - a.id).map((v) => (
            <option key={v.id} value={v.id}>
              {`prompt_version ${v.id}     ${fmtTime(v.createdAt)}`}
              {v.metrics ? `   · F1 ${pct(v.metrics.f1)}` : ""}
              {deployedId === v.id ? "   · 배포됨" : ""}
            </option>
          ))}
        </select>
        <button className="sqbtn" onClick={openImprove} title="프롬프트 개선하기 (편집)">
          <Icon name="edit" size={15} />
        </button>
        <div className="spacer" />
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={20}>20건</option>
          <option value={50}>50건</option>
          <option value={100}>100건</option>
        </select>
        <button
          className={`btn action-btn ${deployEnabled ? "btn-secondary" : "btn-primary"}`}
          onClick={runEvaluation}
          disabled={running}
        >
          {running ? `Testing… ${sel.done}/${sel.total}` : (<><Icon name="play" size={12} /> Test</>)}
        </button>
        <button
          className={`btn action-btn ${deployEnabled ? "btn-primary deploy-emph" : "btn-secondary"}`}
          onClick={deploy}
          disabled={deployDisabled}
          title={selectedId === deployedId ? "이미 배포된 버전입니다" : !sel.metrics ? "먼저 Test를 실행하세요" : "이 버전을 Review 화면에 배포"}
        >
          <Icon name="up" size={14} /> Deploy
        </button>
      </div>

      {!(mode === "mock") && limit === 100 && (
        <div className="hint" style={{ margin: "0 2px 14px" }}>
          실제 Claude 100건은 함수 시간제한에 걸릴 수 있습니다. 중간에 끊겨도 받은 만큼 자동 집계됩니다 — 빠른 시연은 20/50건을 권장합니다.
        </div>
      )}

      <ResultsBlock
        metrics={metrics}
        cmp={cmpMetrics}
        cmpLabel={cmp ? `v${cmp.id}` : ""}
        deployed={deployedId === selectedId}
      />

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          평가 진행 · PASS / FAIL <span className="sub">케이스를 누르면 원문에서 상세 확인</span>
        </div>
        <div className="panel-body" style={{ maxHeight: "52vh" }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: sel.total ? `${(sel.done / sel.total) * 100}%` : "0%" }} />
          </div>
          <div className="progress-meta">
            <span>{sel.done} / {sel.total || "—"} 케이스</span>
            <span>PASS {sel.cases.filter((c) => c.evaluation.pass).length} · FAIL {sel.cases.filter((c) => !c.evaluation.pass).length}</span>
          </div>
          <div className="case-list">
            {sel.cases.length === 0 && <div className="empty">Test를 실행하면 케이스별 결과가 실시간으로 표시됩니다.</div>}
            {sel.cases.map((c) => (
              <div key={c.id} className="case-row" onClick={() => setSelectedCase(c.id)}>
                <span className="cid">{c.id}</span>
                <span className={`pill ${c.evaluation.pass ? "pass" : "fail"}`}>{c.evaluation.pass ? "PASS" : "FAIL"}</span>
                <span className="reason">{c.evaluation.reason}</span>
                <span className="chev"><Icon name="chevron" size={14} /></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {improveOpen && (
        <ImproveDrawer
          versions={versions}
          base={improveBase}
          setBase={(id) => { setImproveBase(id); setImproveText(versions.find((v) => v.id === id)!.system); }}
          text={improveText}
          setText={setImproveText}
          nextId={maxId + 1}
          onSave={saveImprove}
          onClose={() => setImproveOpen(false)}
        />
      )}

      {caseObj && <CaseModal c={caseObj} isMock={mode === "mock"} onClose={() => setSelectedCase(null)} />}
    </div>
  );
}

const METRIC_INFO: Record<string, { desc: string; formula?: string }> = {
  Accuracy: { desc: "전체 판정 중 맞게 맞춘 비율", formula: "( TP + TN ) / 전체" },
  Precision: { desc: "지적한 것 중 실제 이슈였던 비율\n오탐이 적을수록 높음", formula: "TP / ( TP + FP )" },
  Recall: { desc: "실제 이슈 중 놓치지 않고 잡아낸 비율\n누락이 적을수록 높음", formula: "TP / ( TP + FN )" },
  "F1 Score": { desc: "정밀도와 재현율의 균형 (조화평균)", formula: "2 · P · R / ( P + R )" },
  "Rule Compliance": { desc: "출력이 JSON 스키마·형식을 지킨 비율\n형식 안정성", formula: "규칙 준수 출력 / 전체 출력" },
  "Human Agreement": { desc: "사람 정답(Gold)과 유형 단위 판정이\n일치한 비율", formula: "일치 판정 / 전체 판정" },
};

/** 조용히 뜨는 설명 툴팁 (설명 여러 줄 + 수식은 민트). */
function Tip({ label, desc, formula }: { label: string; desc: string; formula?: string }) {
  return (
    <span className="tt">
      {label}
      <span className="tt-box" role="tooltip">
        <span className="tt-desc">{desc}</span>
        {formula && <span className="tt-formula">{formula}</span>}
      </span>
    </span>
  );
}

function ResultsBlock({ metrics, cmp, cmpLabel, deployed }: { metrics: Metrics | null; cmp: Metrics | null; cmpLabel: string; deployed: boolean }) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [f1Cut, setF1Cut] = useState(85);
  const [rcCut, setRcCut] = useState(100);
  const ok = metrics && metrics.f1 * 100 >= f1Cut && metrics.ruleCompliance * 100 >= rcCut;
  const items: { k: string; key: keyof Metrics }[] = [
    { k: "Accuracy", key: "accuracy" },
    { k: "Precision", key: "precision" },
    { k: "Recall", key: "recall" },
    { k: "F1 Score", key: "f1" },
    { k: "Rule Compliance", key: "ruleCompliance" },
    { k: "Human Agreement", key: "humanAgreement" },
  ];
  return (
    <div className="panel">
      <div className="panel-head">평가 결과 <span className="sub">6대 지표 · 혼동행렬</span></div>
      <div className="panel-body">
        {/* 윗줄: 6대 지표 */}
        <div className="summary">
          {items.map(({ k, key }) => {
            const v = metrics ? (metrics[key] as number) : undefined;
            const ov = cmp ? (cmp[key] as number) : undefined;
            const d = v !== undefined && ov !== undefined ? v - ov : undefined;
            return (
              <div className="stat" key={k}>
                <div className="k"><Tip label={k} desc={METRIC_INFO[k].desc} formula={METRIC_INFO[k].formula} /></div>
                <div className="v">{pct(v)}</div>
                {d !== undefined ? (
                  <div className={`d ${Math.abs(d) < 0.0001 ? "" : d > 0 ? "up" : "down"}`}>
                    {Math.abs(d) < 0.0001 ? "동일" : `${d > 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1)}p vs ${cmpLabel}`}
                  </div>
                ) : (
                  <div className="d">{metrics ? "단독 실행" : "채점 대기"}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* 상세 보기 → 좌: 혼동행렬(2×2) / 우: 유형별 F1 */}
        <button className="disclose" onClick={() => setOpen((o) => !o)}>
          <span className={`chev-ic ${open ? "open" : ""}`}><Icon name="chevron" size={14} /></span>
          상세 보기 · 혼동행렬 & 유형별 F1
        </button>
        {open && (
          <div className="disclose-body">
            <div className="detail-col">
              <div className="section-title" style={{ marginTop: 0 }}>혼동행렬 (행: 예측 · 열: 실제)</div>
              <div className="cm">
                <div className="cm-corner">예측 ＼ 실제</div>
                <div className="cm-h">실제 정<span>이슈 있음</span></div>
                <div className="cm-h">실제 오<span>이슈 없음</span></div>

                <div className="cm-h side">예측 정<span>지적</span></div>
                <div className="cm-cell diag">
                  <span className="cm-abbr">TP</span>
                  <span className="cm-val">{metrics?.confusion.tp ?? "—"}</span>
                  <span className="cm-full">True Positive · 정탐</span>
                </div>
                <div className="cm-cell">
                  <span className="cm-abbr">FP</span>
                  <span className="cm-val">{metrics?.confusion.fp ?? "—"}</span>
                  <span className="cm-full">False Positive · 오탐</span>
                </div>

                <div className="cm-h side">예측 오<span>미지적</span></div>
                <div className="cm-cell">
                  <span className="cm-abbr">FN</span>
                  <span className="cm-val">{metrics?.confusion.fn ?? "—"}</span>
                  <span className="cm-full">False Negative · 누락</span>
                </div>
                <div className="cm-cell diag">
                  <span className="cm-abbr">TN</span>
                  <span className="cm-val">{metrics?.confusion.tn ?? "—"}</span>
                  <span className="cm-full">True Negative · 정상</span>
                </div>
              </div>
            </div>

            <div className="detail-col">
              <div className="section-title" style={{ marginTop: 0 }}>유형별 F1 (RCA는 5 Whys/Fishbone 공통)</div>
              {ISSUE_TYPES.map((t) => (
                <div className="bar-row" key={t}>
                  <span>{ISSUE_LABELS[t]}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(metrics?.perType[t].f1 ?? 0) * 100}%` }} />
                  </div>
                  <span className="bar-val">{metrics ? pct(metrics.perType[t].f1) : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Result: 배포 결정 (컷오프 사람이 설정) */}
        <div className="testresult">
          <div className="tr-head">
            <span className="tr-label">
              <Tip
                label="Test Result :"
                desc={"설정한 컷오프 기준으로 배포 권고 여부를 판정합니다.\nRelease 권고 = 기준 충족(배포 가능)\n개선 필요 = 미달(프롬프트 개선 필요)"}
              />
            </span>
            {metrics ? (
              <span className="tr-verdict" style={{ color: ok ? "var(--ds-brand)" : "var(--ds-text-muted)" }}>
                {ok ? "Release 권고" : "개선 필요"}{deployed ? " · 현재 배포됨" : ""}
              </span>
            ) : (
              <span className="hint">Test 실행 후 판단됩니다.</span>
            )}
            <button className="gear" onClick={() => setSettingsOpen((o) => !o)} title="판정 기준(cut-off) 설정">
              <Icon name="settings" size={15} />
            </button>
          </div>
          {settingsOpen && (
            <div className="tr-settings">
              <label className="tr-field">
                F1 ≥ <input type="number" min={0} max={100} value={f1Cut} onChange={(e) => setF1Cut(Number(e.target.value))} /> %
              </label>
              <label className="tr-field">
                Rule Compliance ≥ <input type="number" min={0} max={100} value={rcCut} onChange={(e) => setRcCut(Number(e.target.value))} /> %
              </label>
              <span className="hint">이 기준 이상이면 Release 권고로 표시됩니다.</span>
            </div>
          )}
          {metrics && (
            <div className="hint">기준 F1 ≥ {f1Cut}% · Rule Compliance ≥ {rcCut}% (현재 F1 {pct(metrics.f1)} · RC {pct(metrics.ruleCompliance)})</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImproveDrawer({
  versions, base, setBase, text, setText, nextId, onSave, onClose,
}: {
  versions: Version[];
  base: number;
  setBase: (id: number) => void;
  text: string;
  setText: (s: string) => void;
  nextId: number;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <h3>프롬프트 개선하기 → v{nextId}</h3>
          <button className="iconbtn" onClick={onClose}><Icon name="close" size={15} /></button>
        </div>
        <div className="drawer-body">
          <div className="field">
            <label>기준 버전</label>
            <select value={base} onChange={(e) => setBase(Number(e.target.value))}>
              {[...versions].sort((a, b) => b.id - a.id).map((v) => (
                <option key={v.id} value={v.id}>v{v.id}{v.metrics ? ` · F1 ${pct(v.metrics.f1)}` : ""}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>프롬프트 (system)</label>
            <textarea className="prompt" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          </div>
          <div className="hint">저장하면 v{nextId}로 추가되고 상단에서 선택됩니다. 채점 실행 후 결과가 좋으면 "배포하기".</div>
        </div>
        <div className="drawer-foot">
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onSave}>v{nextId}로 저장</button>
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
          <button className="iconbtn" onClick={onClose}><Icon name="close" size={15} /></button>
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
