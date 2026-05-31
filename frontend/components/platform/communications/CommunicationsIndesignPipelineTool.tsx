"use client";

import { useCallback, useMemo, useState } from "react";
import { FileDown, FileUp, Sparkles } from "lucide-react";
import { XplorProgramPreview } from "@/components/communications/xplor/XplorProgramPreview";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  extractTextFromFile,
  isXplorTaggedInput,
  preprocessInput,
  runPublicationPipeline,
} from "@/communications/xplor";

const ACCEPT = ".rtf,.txt,text/plain,application/rtf";

/** InDesign-first publication pipeline — export quality over browser preview. */
export function CommunicationsIndesignPipelineTool() {
  const [title, setTitle] = useState("Untitled handoff");
  const [body, setBody] = useState("");
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [showQaPreview, setShowQaPreview] = useState(true);
  const [exportPreviewMode, setExportPreviewMode] = useState<"canonical" | "xplor">("xplor");

  const preprocessed = useMemo(() => (body.trim() ? preprocessInput(body, { filename: sourceName }) : null), [body, sourceName]);

  const pipeline = useMemo(() => {
    if (!preprocessed?.plainText.trim()) return null;
    if (!isXplorTaggedInput(preprocessed.plainText)) return null;
    return runPublicationPipeline(body, { filename: sourceName });
  }, [body, sourceName, preprocessed?.plainText]);

  const canonicalExportTxt = pipeline?.export.taggedTxt ?? preprocessed?.plainText ?? "";
  const xplorExportTxt = pipeline?.export.xplorNativeTxt ?? preprocessed?.plainText ?? "";
  const exportTxt = exportPreviewMode === "xplor" ? xplorExportTxt : canonicalExportTxt;
  const hasPublication = Boolean(pipeline?.document.entries.length);

  const downloadBlob = useCallback((text: string, suffix: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    const safe = title.replace(/[^\w\-]+/g, "_").slice(0, 80) || "indesign_handoff";
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}${suffix}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [title]);

  const downloadCanonicalTxt = useCallback(() => {
    downloadBlob(canonicalExportTxt, "_canonical");
  }, [canonicalExportTxt, downloadBlob]);

  const downloadXplorTxt = useCallback(() => {
    downloadBlob(xplorExportTxt, "_xplor");
  }, [downloadBlob, xplorExportTxt]);

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setSourceName(file.name);
    try {
      const { plainText } = await extractTextFromFile(file);
      setBody(plainText);
    } catch {
      setBody("");
    }
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ds-foreground">Xplor → InDesign publication pipeline</h1>
        <p className="mt-1 text-sm text-ds-muted">
          Parse and clean Xplor tagged text, then export for Adobe InDesign (File → Place). The brochure preview below
          is React layout only — it is not written into the <span className="font-mono">.txt</span>. InDesign only
          recognizes <span className="font-mono">pstyle:</span> paragraph style names in the export file; use the
          Xplor-native download if your template uses <span className="font-mono">Eventname</span> /{" "}
          <span className="font-mono">Eventdetail</span> styles.
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
                {preprocessed?.sourceFormat ? (
                  <span className="text-ds-muted">
                    {" "}
                    · {preprocessed.sourceFormat === "rtf" ? "RTF → plain text" : "plain text"}
                  </span>
                ) : null}
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

      <Card className="space-y-4 p-5 border-[color-mix(in_srgb,var(--ds-accent)_22%,transparent)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ds-foreground">InDesign export</h2>
          <div className="flex flex-wrap items-center gap-2">
            {hasPublication ? (
              <span className="text-xs text-ds-muted">
                {pipeline!.export.paragraphCount} paragraphs · confidence{" "}
                {(pipeline!.document.confidence * 100).toFixed(0)}%
              </span>
            ) : null}
            <div className="inline-flex rounded-lg border border-ds-border p-0.5 text-xs">
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 font-semibold",
                  exportPreviewMode === "xplor"
                    ? "bg-[var(--ds-accent)] text-white"
                    : "text-ds-muted hover:text-ds-foreground",
                )}
                onClick={() => setExportPreviewMode("xplor")}
              >
                Xplor styles
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 font-semibold",
                  exportPreviewMode === "canonical"
                    ? "bg-[var(--ds-accent)] text-white"
                    : "text-ds-muted hover:text-ds-foreground",
                )}
                onClick={() => setExportPreviewMode("canonical")}
              >
                Canonical styles
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-ds-muted">
          {exportPreviewMode === "xplor" ? (
            <>
              Uses original Xplor style names (<span className="font-mono">Eventname</span>,{" "}
              <span className="font-mono">Eventdetail</span>, …) — best for existing InDesign paragraph style libraries.
            </>
          ) : (
            <>
              Uses normalized style names (<span className="font-mono">ProgramTitle</span>,{" "}
              <span className="font-mono">SessionDays</span>, …) — best for GREP templates built for this pipeline.
            </>
          )}
        </p>
        <pre
          className={cn(
            "max-h-[320px] overflow-auto whitespace-pre-wrap rounded-lg border border-ds-border bg-ds-secondary p-3",
            "font-mono text-xs leading-relaxed text-ds-foreground",
          )}
        >
          {exportTxt || "—"}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ds-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!xplorExportTxt.trim()}
            onClick={downloadXplorTxt}
          >
            <FileDown className="h-4 w-4" aria-hidden />
            Download Xplor-native .txt
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-secondary px-4 py-2 text-sm font-semibold text-ds-foreground disabled:opacity-50"
            disabled={!canonicalExportTxt.trim()}
            onClick={downloadCanonicalTxt}
          >
            <FileDown className="h-4 w-4" aria-hidden />
            Download canonical .txt
          </button>
        </div>
      </Card>

      {(preprocessed?.plainText ?? "").trim() && showQaPreview ? (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-ds-foreground">
              <Sparkles className="h-4 w-4 text-[var(--ds-accent)]" aria-hidden />
              <h2 className="text-sm font-bold uppercase tracking-wide text-ds-muted">Semantic QA preview</h2>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-ds-muted hover:text-ds-foreground"
              onClick={() => setShowQaPreview(false)}
            >
              Hide
            </button>
          </div>
          {hasPublication ? (
            <XplorProgramPreview
              document={pipeline!.document}
              rawTaggedSample={(preprocessed?.plainText ?? "").slice(0, 4000)}
              compareMode={compareMode}
              onCompareModeChange={setCompareMode}
            />
          ) : (
            <p className="text-sm text-ds-muted">
              No Xplor <span className="font-mono">pstyle:</span> tags detected. Paste tagged export from Xplor or use
              the raw editor above.
            </p>
          )}
        </Card>
      ) : null}

      {(preprocessed?.plainText ?? "").trim() && !showQaPreview ? (
        <button
          type="button"
          className="text-sm font-semibold text-[var(--ds-accent)] hover:underline"
          onClick={() => setShowQaPreview(true)}
        >
          Show semantic QA preview
        </button>
      ) : null}
    </div>
  );
}
