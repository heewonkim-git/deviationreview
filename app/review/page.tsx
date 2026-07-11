"use client";

import { useEffect, useRef, useState } from "react";
import { AgentOutput, ISSUE_LABELS, IssueType } from "@/lib/types";
import { ConfirmedPrompt, loadConfirmed } from "@/lib/confirmed";
import { DocumentViewer } from "../components/DocumentViewer";

const SEV_LABEL: Record<string, string> = { low: "낮음", medium: "중간", high: "높음" };
const TYPE_COLORS: Record<IssueType, string> = {
  missing_5whys: "var(--ds-accent-1)",
  weak_root_cause: "var(--ds-accent-2)",
  missing_capa: "var(--ds-accent-3)",
  unsupported_claims: "var(--ds-accent-4)",
  logical_issues: "var(--ds-info)",
};

export default function ReviewerPage() {
  const [confirmed, setConfirmed] = useState<ConfirmedPrompt | null>(null);
  const [mode, setMode] = useState("mock");
  const [forceMock, setForceMock] = useState(false);
  const [samples, setSamples] = useState<{ id: string; draft: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [fileName, setFileName] = useState<string>("");
  const [result, setResult] = useState<AgentOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfirmed(loadConfirmed());
    fetch("/api/dataset")
      .then((r) => r.json())
      .then((d) => {
        setMode(d.mode);
        setSamples(d.samples || []);
      })
      .catch(() => {});
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    setErr(null);
    try {
      if (f.name.toLowerCase().endsWith(".docx")) {
        const buf = await f.arrayBuffer();
        const m: any = await import("mammoth/mammoth.browser");
        const lib = m.default ?? m;
        const out = await lib.extractRawText({ arrayBuffer: buf });
        setDraft(out.value || "");
      } else {
        setDraft(await f.text());
      }
    } catch {
      setErr("파일을 읽지 못했습니다. .docx / .txt / .md 를 지원합니다.");
    }
  }

  async function runReview() {
    if (!draft.trim() || loading || !confirmed) return;
    setLoading(true);
    setResult(null);
    setErr(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          system: confirmed.system,
          promptId: confirmed.versionId,
          useMock: forceMock || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) setErr(`리뷰 오류: ${data.error}`);
      else if (!data.output) setErr("에이전트 출력이 규칙을 위반했습니다.");
      else setResult(data.output as AgentOutput);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const verdictColor =
    result?.overall_verdict === "pass"
      ? "var(--ds-success)"
      : result?.overall_verdict === "fail"
      ? "var(--ds-danger)"
      : "var(--ds-warning)";
  const verdictLabel =
    result?.overall_verdict === "pass"
      ? "이상 없음 (Pass)"
      : result?.overall_verdict === "fail"
      ? "중대 결함 (Fail)"
      : "수정 필요 (Needs revision)";
  const isMock = forceMock || mode === "mock";

  return (
    <div className="page">
      <div className="page-head">
        <span className="eyebrow" style={{ color: "var(--ds-brand)" }}>
          실사용 화면 · 현업 검토자
        </span>
        <h1>
          편차 문서를 올리면 <span className="blue">확정된 프롬프트</span>로 리뷰합니다
        </h1>
        <div className="tag">
          Word(.docx) 또는 텍스트 파일을 업로드하면, 배포된 리뷰 에이전트가 문제 구간을 짚어줍니다.
        </div>
      </div>

      <div className="reviewer">
        <div className="rev-controls">
          <div className="confirmed-card">
            <div className="eyebrow">현재 배포된 프롬프트</div>
            <div style={{ fontWeight: 700, fontSize: "var(--ds-text-md)", margin: "4px 0" }}>
              {confirmed?.label ?? "—"}
            </div>
            <div className="hint">
              {confirmed?.f1 !== undefined
                ? `검증 F1 ${(confirmed.f1 * 100).toFixed(1)}%`
                : "기본 배포 버전"}
              {confirmed?.at === "default" ? " · (랩에서 아직 배포 안 함)" : " · 랩에서 배포됨"}
            </div>
          </div>

          <div className="field">
            <label>편차 문서 업로드 (.docx / .txt / .md)</label>
            <input ref={fileRef} type="file" accept=".docx,.txt,.md" onChange={onFile} style={{ display: "none" }} />
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              📄 파일 선택 {fileName && `· ${fileName}`}
            </button>
          </div>

          {samples.length > 0 && (
            <div className="field">
              <label>또는 예시 문서 불러오기</label>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {samples.map((s) => (
                  <button
                    key={s.id}
                    className="btn btn-ghost"
                    onClick={() => { setDraft(s.draft); setFileName(`${s.id} (예시)`); setResult(null); }}
                  >
                    {s.id}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label>원문 (직접 붙여넣기/수정 가능)</label>
            <textarea className="draft-in" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="여기에 편차 리포트 원문을 붙여넣거나 파일을 업로드하세요." />
          </div>

          <label className="checkline hint">
            <input type="checkbox" checked={forceMock} onChange={(e) => setForceMock(e.target.checked)} />
            Mock 모드로 리뷰 (API 비용 없음)
          </label>
          <button className="btn btn-primary btn-lg" onClick={runReview} disabled={!draft.trim() || loading}>
            {loading ? "리뷰 중…" : "▶ 리뷰 실행"}
          </button>
          {err && <div className="hint" style={{ color: "var(--ds-danger)" }}>{err}</div>}
        </div>

        <div className="rev-result">
          {!result && !draft && (
            <div className="panel"><div className="empty">문서를 업로드하고 리뷰를 실행하면 결과가 여기에 표시됩니다.</div></div>
          )}
          {!result && draft && !loading && (
            <div className="panel"><div className="empty">"리뷰 실행"을 누르면 에이전트가 문서를 검토합니다.</div></div>
          )}
          {result && (
            <>
              <div className="rev-summary">
                <span className="verdict" style={{ color: verdictColor, borderColor: verdictColor, background: `color-mix(in srgb, ${verdictColor} 12%, var(--ds-surface))` }}>
                  {verdictLabel}
                </span>
                {result.issues.length === 0 ? (
                  <span className="issue-chip" style={{ color: "var(--ds-success)", borderColor: "var(--ds-success)" }}>지적된 이슈 없음</span>
                ) : (
                  result.issues.map((i, idx) => (
                    <span key={idx} className="issue-chip" style={{ color: TYPE_COLORS[i.type], borderColor: TYPE_COLORS[i.type] }}>
                      {ISSUE_LABELS[i.type]} · {SEV_LABEL[i.severity] ?? i.severity}
                    </span>
                  ))
                )}
              </div>
              <div className="panel">
                <div className="panel-head">
                  리뷰 결과 · 원문 하이라이트 <span className="sub">{isMock ? "Mock" : "Claude"} · {result.issues.length}건 지적</span>
                </div>
                <div className="modal-scroll" style={{ borderRadius: 0 }}>
                  <DocumentViewer draft={draft} agent={result} title="업로드된 편차 문서" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
