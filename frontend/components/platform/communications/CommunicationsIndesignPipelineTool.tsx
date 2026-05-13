"use client";

import { useCallback, useMemo, useState } from "react";
import { FileDown, FileUp, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const ACCEPT = ".rtf,.txt,text/plain,application/rtf";

/** Client-side prep for InDesign handoff: normalize text, strip common RTF control noise (light pass), export clean UTF-8. */
export function CommunicationsIndesignPipelineTool() {
  const [title, setTitle] = useState("Untitled handoff");
  const [body, setBody] = useState("");
  const [sourceName, setSourceName] = useState<string | null>(null);

  const normalized = useMemo(() => stripRtfToPlain(body), [body]);

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
    const blob = new Blob([normalized], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    const safe = title.replace(/[^\w\-]+/g, "_").slice(0, 80) || "indesign_handoff";
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [normalized, title]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ds-foreground">RTF / TXT → InDesign pipeline</h1>
        <p className="mt-1 text-sm text-ds-muted">
          Upload a story file, preview cleaned plain text, then download a UTF-8 <span className="font-mono">.txt</span>{" "}
          for placing in Adobe InDesign (File → Place). This is a first-mile studio tool — heavy layout stays in
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
          />
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-ds-foreground">
          <Sparkles className="h-4 w-4 text-[var(--ds-accent)]" aria-hidden />
          <h2 className="text-sm font-bold uppercase tracking-wide text-ds-muted">Cleaned preview</h2>
        </div>
        <pre
          className={cn(
            "max-h-[320px] overflow-auto whitespace-pre-wrap rounded-lg border border-ds-border bg-ds-secondary p-3",
            "font-mono text-xs leading-relaxed text-ds-foreground",
          )}
        >
          {normalized || "—"}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ds-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!normalized.trim()}
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

function stripRtfToPlain(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/\r\n/g, "\n");
  // If it looks like RTF, strip common groups (not a full RTF parser — good enough for pasted stories).
  if (s.includes("{\\rtf")) {
    s = s
      .replace(/\{\\\*\\[^{}]*\}/g, "")
      .replace(/\\'[0-9a-fA-F]{2}/g, (m) => {
        const code = parseInt(m.slice(2), 16);
        return Number.isFinite(code) ? String.fromCharCode(code) : "";
      })
      .replace(/\\par\b/g, "\n")
      .replace(/\\line\b/g, "\n")
      .replace(/\\tab\b/g, "\t")
      .replace(/\\[a-z]+\d* ?/gi, "")
      .replace(/[{}]/g, "");
  }
  return s.replace(/\n{3,}/g, "\n\n").trim();
}
