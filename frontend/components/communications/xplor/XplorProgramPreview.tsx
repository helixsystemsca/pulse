"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import { SplitPreviewLayout } from "@/components/communications/SplitPreviewLayout";
import { cn } from "@/lib/cn";
import type { PublicationDocument, PublicationWarning } from "@/communications/xplor/schema/publication";
import { XplorPreviewCard } from "./XplorPreviewCard";

type XplorProgramPreviewProps = {
  document: PublicationDocument;
  rawTaggedSample?: string;
  compareMode?: boolean;
  onCompareModeChange?: (value: boolean) => void;
  className?: string;
};

function warningLabel(w: PublicationWarning | string): string {
  return typeof w === "string" ? w : w.message;
}

export function XplorProgramPreview({
  document,
  rawTaggedSample,
  compareMode = false,
  onCompareModeChange,
  className,
}: XplorProgramPreviewProps) {
  const entries = document.entries;
  const warnings = [
    ...document.warnings.map(warningLabel),
    ...entries.flatMap((e) => e.warnings.map(warningLabel)),
  ];

  if (!entries.length) {
    return (
      <p className="rounded-lg border border-dashed border-ds-border bg-ds-secondary/20 px-4 py-8 text-center text-sm text-ds-muted">
        No structured programs detected. Paste Xplor-tagged text (pstyle:Eventage, Eventname, …) or upload a .txt export.
      </p>
    );
  }

  const cards = (
    <div className="grid gap-4 sm:grid-cols-2">
      {entries.map((entry, index) => (
        <XplorPreviewCard key={entry.id} entry={entry} index={index} />
      ))}
    </div>
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">
          QA preview · {entries.length} program{entries.length === 1 ? "" : "s"} · confidence{" "}
          {(document.confidence * 100).toFixed(0)}%
        </p>
        {onCompareModeChange ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ds-border px-2.5 py-1 text-[11px] font-semibold text-ds-foreground hover:bg-ds-secondary/50"
            onClick={() => onCompareModeChange(!compareMode)}
          >
            {compareMode ? <Rows3 className="h-3.5 w-3.5" aria-hidden /> : <LayoutGrid className="h-3.5 w-3.5" aria-hidden />}
            {compareMode ? "Stacked view" : "Side-by-side"}
          </button>
        ) : null}
      </div>

      {warnings.length > 0 ? (
        <ul className="max-h-32 overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          {warnings.slice(0, 12).map((w, i) => (
            <li key={`${w}-${i}`}>{w}</li>
          ))}
          {warnings.length > 12 ? <li>…and {warnings.length - 12} more</li> : null}
        </ul>
      ) : null}

      {compareMode && rawTaggedSample ? (
        <SplitPreviewLayout
          leftTitle="Source tags"
          rightTitle="Normalized schema"
          left={
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ds-muted">{rawTaggedSample}</pre>
          }
          right={cards}
        />
      ) : (
        <div className="max-h-[min(520px,60vh)] overflow-y-auto pr-1">{cards}</div>
      )}
    </div>
  );
}
