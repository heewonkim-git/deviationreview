"use client";

import { useEffect, useRef, useState } from "react";
import { AgentOutput, ISSUE_LABELS } from "@/lib/types";
import { parseDeviation } from "@/lib/deviation";
import { modelLabel } from "@/lib/models";
import { ConfirmedPrompt, loadConfirmed } from "@/lib/confirmed";
import { DocumentViewer, buildNotes, COMMENT_AUTHOR } from "../components/DocumentViewer";
import { Icon } from "../components/Icon";
import { Tip } from "../components/Tip";

const SEV_LABEL: Record<string, string> = { low: "낮음", medium: "중간", high: "높음" };
const MINT = "var(--ds-brand)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STEPS = [
  "문서 파싱 중…",
  "5 Whys 근본원인 분석 검토…",
  "Root Cause 타당성 검토…",
  "CAPA(시정·예방조치) 확인…",
  "근거 없는 주장 스캔…",
  "논리 일관성 검토…",
];

type Phase = "idle" | "streaming" | "done";

export default function ReviewerPage() {
  const [confirmed, setConfirmed] = useState<ConfirmedPrompt | null>(null);
  const [mode, setMode] = useState("mock");
  const [samples, setSamples] = useState<{ id: string; draft: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<string[]>([]);
  const [result, setResult] = useState<AgentOutput | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
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

  async function processFile(f: File) {
    setFileName(f.name);
    setResult(null);
    setPhase("idle");
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

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }

  async function runReview() {
    if (!draft.trim() || !confirmed || phase === "streaming") return;
    setPhase("streaming");
    setResult(null);
    setErr(null);
    setLines([]);
    const apiPromise = fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draft,
        system: confirmed.system,
        promptId: confirmed.versionId,
        model: confirmed.model,
      }),
    }).then((r) => r.json());

    for (const s of STEPS) {
      setLines((l) => [...l, s]);
      await sleep(430);
    }
    try {
      const data = await apiPromise;
      if (data.source) setMode(data.source); // Claude 실패 → Mock 폴백 시 배지 반영
      if (data.error) setErr(`리뷰 오류: ${data.error}`);
      else if (!data.output) setErr("에이전트 출력이 규칙을 위반했습니다.");
      else setResult(data.output as AgentOutput);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setLines((l) => [...l, "분석 완료"]);
    setPhase("done");
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setLines([]);
    setDraft("");
    setFileName("");
    setErr(null);
  }

  async function downloadDoc() {
    if (!result) return;
    // 양식(표)을 유지한 .docx 생성 + 지적 섹션에 실제 Word 검토 코멘트 부착.
    // 상단 안내문 없이 양식 바로 시작. 꼭 할 말(종합)은 문서 타이틀에 코멘트로.
    const D = await import("docx");
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, CommentRangeStart, CommentRangeEnd, CommentReference, AlignmentType } = D;
    const AUTHOR = COMMENT_AUTHOR;
    const notes = buildNotes(result, undefined);
    const sections = parseDeviation(draft);
    let cid = 0;
    const comments: any[] = [];
    const children: any[] = [];

    const bodyToTable = (body: string) => {
      const rows: any[] = [];
      body.split("\n").forEach((line) => {
        line.split("|").map((p) => p.trim()).filter(Boolean).forEach((part) => {
          const m = part.match(/^(.+?):\s*(.*)$/);
          if (m && m[2] !== "") {
            rows.push(new TableRow({ children: [
              new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: "F5F5F5" }, children: [new Paragraph({ children: [new TextRun({ text: m[1], size: 18 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m[2], size: 18 })] })] }),
            ] }));
          } else {
            rows.push(new TableRow({ children: [new TableCell({ columnSpan: 2, children: [new Paragraph({ children: [new TextRun({ text: part, size: 18 })] })] })] }));
          }
        });
      });
      return rows.length ? new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }) : null;
    };

    for (const sec of sections) {
      if (!sec.heading) {
        const lines = sec.body.split("\n").map((l) => l.trim()).filter(Boolean);
        lines.forEach((l, i) => {
          if (i === 0) {
            // 문서 타이틀 + 종합 코멘트(꼭 할 말)
            const id = cid++;
            const cc: any[] = [new Paragraph({ children: [new TextRun({ text: `판정: ${verdictLabel}`, bold: true })] })];
            if (result.issues.length) result.issues.forEach((iss, k) => cc.push(new Paragraph({ children: [new TextRun({ text: `${k + 1}. ${ISSUE_LABELS[iss.type]} — ${iss.explanation}` })] })));
            else cc.push(new Paragraph({ children: [new TextRun({ text: "지적된 이슈 없음" })] }));
            comments.push({ id, author: AUTHOR, initials: "DRP", date: new Date(), children: cc });
            children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new CommentRangeStart(id), new TextRun({ text: l, bold: true, size: 28 }), new CommentRangeEnd(id), new CommentReference(id)] }));
          } else {
            children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: l, size: 18, color: "666666" })] }));
          }
        });
        continue;
      }
      const note = sec.issueType ? notes[sec.issueType] : undefined;
      if (note) {
        const id = cid++;
        comments.push({ id, author: AUTHOR, initials: "DRP", date: new Date(), children: [
          new Paragraph({ children: [new TextRun({ text: note.label, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: note.text })] }),
        ] });
        children.push(new Paragraph({ spacing: { before: 160 }, shading: { fill: "ECECEC" }, children: [new CommentRangeStart(id), new TextRun({ text: sec.heading, bold: true }), new CommentRangeEnd(id), new CommentReference(id)] }));
      } else {
        children.push(new Paragraph({ spacing: { before: 160 }, shading: { fill: "ECECEC" }, children: [new TextRun({ text: sec.heading, bold: true })] }));
      }
      const t = bodyToTable(sec.body);
      if (t) children.push(t);
    }

    const doc = new Document({ comments: { children: comments }, sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fileName || "deviation_review").replace(/\.[^.]+$/, "")}_review.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const ver = confirmed ? `${confirmed.version}.0` : "—";
  const isMock = mode === "mock";
  const issues = result?.issues ?? [];
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

  return (
    <div className="page">
      <div className="rev-top">
        <span className="pv">
          Prompt version : {ver}
          {confirmed && <span style={{ color: "var(--ds-text-subtle)" }}>　·　{modelLabel(confirmed.model)}</span>}
        </span>
      </div>

      <div className="rev2">
        {/* LEFT — upload / streaming */}
        <div className="rev-left">
          {phase === "idle" ? (
            <>
              <input ref={fileRef} type="file" accept=".docx,.txt,.md" style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
              <div
                className={`dropzone ${dragging ? "drag" : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <span className="dz-icon"><Icon name="upload" size={28} /></span>
                <div className="big">편차 문서를 여기에 끌어다 놓기</div>
                <div className="hint">또는 클릭해서 파일 선택 · .docx / .txt / .md</div>
                {fileName && <div className="loaded">{fileName} 불러옴</div>}
              </div>

              <button className="btn btn-primary btn-lg rev-start" disabled={!draft.trim()} onClick={runReview}>
                <Icon name="play" size={13} /> Review Start
              </button>

              <div className="rev-secondary">
                <button className="linkish" onClick={() => setShowPaste((v) => !v)}>직접 붙여넣기</button>
                {samples.length > 0 && (
                  <span className="samples">
                    예시
                    {samples.map((s) => (
                      <button key={s.id} className="linkish" onClick={() => { setDraft(s.draft); setFileName(`${s.id} (예시)`); }}>
                        {s.id}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              {showPaste && (
                <textarea className="draft-in" style={{ marginTop: 12 }} value={draft}
                  onChange={(e) => setDraft(e.target.value)} placeholder="여기에 편차 리포트 원문을 붙여넣으세요." />
              )}
              {err && <div className="hint" style={{ color: "var(--ds-danger)", marginTop: 10 }}>{err}</div>}
            </>
          ) : (
            <div className="stream-panel">
              <div className="stream-head">
                <span>{fileName || "문서"} 분석 {phase === "streaming" ? "중…" : "완료"}</span>
                <button className="linkish" onClick={reset}>새 문서</button>
              </div>
              <div className="stream-feed">
                {lines.map((l, i) => (
                  <div className="stream-line" key={i}>
                    <span className="tick" /> {l}
                  </div>
                ))}
                {phase === "streaming" && (
                  <div className="stream-line active">
                    <span className="spinner" /> 분석 중…
                  </div>
                )}
                {err && <div className="hint" style={{ color: "var(--ds-danger)", marginTop: 8 }}>{err}</div>}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — summary */}
        <div className="rev-right">
          {phase !== "done" || !result ? (
            <div className="panel">
              <div className="empty">분석이 끝나면 종합 결과가 여기에 표시됩니다.</div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-head">
                <Tip
                  label="종합 결과"
                  desc={"판정은 세 가지로 나뉩니다.\n① 이상 없음 (Pass) — 지적된 이슈 없음, 그대로 진행\n② 수정 필요 (Needs revision) — 경미한 이슈, 보완 후 진행\n③ 중대 결함 (Fail) — 중대한 이슈, 재작성 필요"}
                />
                <span className="sub">{result.issues.length}건 지적</span>
              </div>
              <div className="panel-body">
                <span className="result-verdict" style={{ color: verdictColor, borderColor: verdictColor }}>
                  {verdictLabel}
                </span>
                {issues.length === 0 ? (
                  <div className="hint" style={{ marginTop: 12 }}>지적된 이슈가 없습니다.</div>
                ) : (
                  <>
                    <ol className="fix-list" style={{ marginTop: 10 }}>
                      {issues.map((i, idx) => (
                        <li className="fix-item" key={idx}>
                          <span className="fix-num">{idx + 1}</span>
                          <div>
                            <div className="fix-t">{ISSUE_LABELS[i.type]}</div>
                            <div className="fix-d">
                              {i.explanation}
                              <span style={{ color: MINT }}> · 심각도 {SEV_LABEL[i.severity] ?? i.severity}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
                <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={() => setDetail(true)}>
                  <Icon name="chevron" size={13} /> 원문에서 상세 보기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {detail && result && (
        <div className="modal-wrap">
          <div className="scrim" onClick={() => setDetail(false)} />
          <div className="modal-card">
            <div className="modal-head">
              <span className="t">원문 상세 · 문제 구간 하이라이트</span>
              <div className="row" style={{ gap: 4 }}>
                <button className="iconbtn" onClick={downloadDoc} title="Word(.doc)로 다운로드">
                  <Icon name="download" size={15} />
                </button>
                <button className="iconbtn" onClick={() => setDetail(false)}><Icon name="close" size={15} /></button>
              </div>
            </div>
            <div className="modal-scroll">
              <DocumentViewer draft={draft} agent={result} title={fileName || "업로드된 편차 문서"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
