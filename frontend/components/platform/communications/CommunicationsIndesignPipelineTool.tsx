"use client";

import { useCallback, useMemo, useState } from "react";
import { FileDown, FileUp, Sparkles } from "lucide-react";
import { XplorProgramPreview } from "@/components/communications/xplor/XplorProgramPreview";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { isXplorTaggedInput, runXplorPipeline } from "@/communications/xplor";
import { stripRtfToPlain } from "@/communications/xplor/rtf";

const ACCEPT = ".rtf,.txt,text/plain,application/rtf";

/** Xplor-tagged text → structured programs → normalized export for InDesign. */
export function CommunicationsIndesignPipelineTool() {
  const [title, setTitle] = useState("Untitled handoff");
  const [body, setBody] = useState("");
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const plainText = useMemo(() => stripRtfToPlain(body), [body]);

  const pipeline = useMemo(() => {
    if (!plainText.trim()) return null;
    if (!isXplorTaggedInput(plainText)) return null;
    return runXplorPipeline(plainText);
  }, [plainText]);

  const exportText = pipeline?.exportText ?? plainText;
  const hasStructuredPrograms = Boolean(pipeline?.programs.length);

  const onFile = useCallback((file: File | null) => {
    if (!file) return;
    setSourceName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setBody(text);
    };
    reader.readAsText(file);
  }, []);

  const downloadTxt = useCallback(() => {
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    const safe = title.replace(/[^\w\-]+/g, "_").slice(0, 80) || "indesign_handoff";
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [exportText, title]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ds-foreground">RTF / TXT → InDesign pipeline</h1>
        <p className="mt-1 text-sm text-ds-muted">
          Upload or paste Xplor-tagged story text, preview structured program cards, then download normalized UTF-8{" "}
          <span className="font-mono">.txt</span> for Adobe InDesign (File → Place). Layout and final typography stay in
          InDesign.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">Handoff title</label>
        <input
          className="w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">Source file</label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ds-border bg-ds-secondary px-4 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-muted/20">
              <FileUp className="h-4 w-4" aria-hidden />
              Choose RTF or TXT
              <input
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {sourceName ? (
              <span className="text-xs text-ds-muted">
                Loaded <span className="font-mono text-ds-foreground">{sourceName}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">Raw editor (optional)</label>
          <textarea
            className="mt-2 min-h-[180px] w-full rounded-lg border border-ds-border bg-ds-primary p-3 font-mono text-xs leading-relaxed text-ds-foreground"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
            placeholder="<pstyle:Eventage>3 - 5 yrs&#10;<pstyle:Eventname>Program title…"
          />
        </div>
      </Card>

      {plainText.trim() ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-ds-foreground">
            <Sparkles className="h-4 w-4 text-[var(--ds-accent)]" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-wide text-ds-muted">Structured preview</h2>
          </div>
          {hasStructuredPrograms ? (
            <XplorProgramPreview
              programs={pipeline!.programs}
              rawTaggedSample={plainText.slice(0, 4000)}
              warnings={pipeline!.parse.warnings}
              compareMode={compareMode}
              onCompareModeChange={setCompareMode}
            />
          ) : (
            <p className="text-sm text-ds-muted">
              No Xplor <span className="font-mono">pstyle:</span> tags detected — use tagged export from Xplor or paste
              sample lines like <span className="font-mono">pstyle:Eventage</span>. Plain cleanup preview is below.
            </p>
          )}
        </Card>
      ) : null}

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ds-muted">
          {hasStructuredPrograms ? "Tagged export preview" : "Cleaned preview"}
        </h2>
        <pre
          className={cn(
            "max-h-[280px] overflow-auto whitespace-pre-wrap rounded-lg border border-ds-border bg-ds-secondary p-3",
            "font-mono text-xs leading-relaxed text-ds-foreground",
          )}
        >
          {exportText || "—"}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ds-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!exportText.trim()}
            onClick={downloadTxt}
          >
            <FileDown className="h-4 w-4" aria-hidden />
            Download .txt for InDesign
          </button>
        </div>
      </Card>
    </div>
  );
}
