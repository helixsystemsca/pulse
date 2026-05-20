"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import { SplitPreviewLayout } from "@/components/communications/SplitPreviewLayout";
import { cn } from "@/lib/cn";
import type { PublicationDocument } from "@/communications/xplor/schema/publication";
import {
  warningPreviewLabel,
  warningsForPreviewDisplay,
} from "@/communications/xplor/preview/ui-warnings";
import { XplorPreviewCard } from "./XplorPreviewCard";

type XplorProgramPreviewProps = {
  document: PublicationDocument;
  rawTaggedSample?: string;
  compareMode?: boolean;
  onCompareModeChange?: (value: boolean) => void;
  className?: string;
};

export function XplorProgramPreview({
  document,
  rawTaggedSample,
  compareMode = false,
  onCompareModeChange,
  className,
}: XplorProgramPreviewProps) {
  const entries = document.entries;

  const previewWarnings = [
    ...warningsForPreviewDisplay(document.warnings),
    ...entries.flatMap((e) => warningsForPreviewDisplay(e.warnings)),
  ].map(warningPreviewLabel);

  if (!entries.length) {
    return (
      <p className="rounded-lg border border-dashed border-ds-border bg-ds-secondary/20 px-4 py-8 text-center text-sm text-ds-muted">
        No structured programs detected. Paste Xplor-tagged text (pstyle:Eventage, Eventname, …) or upload a .txt export.
      </p>
    );
  }

  const editorialPrograms = (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-10">
      {entries.map((entry, index) => (
        <XplorPreviewCard key={entry.id} entry={entry} index={index} layout="editorial" />
      ))}
    </div>
  );

  return (
    <div className={cn("w-full min-w-0 max-w-none space-y-3", className)}>
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

      {previewWarnings.length > 0 ? (
        <ul className="max-h-32 overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          {previewWarnings.slice(0, 12).map((w, i) => (
            <li key={`${w}-${i}`}>{w}</li>
          ))}
          {previewWarnings.length > 12 ? <li>…and {previewWarnings.length - 12} more</li> : null}
        </ul>
      ) : null}

      {compareMode && rawTaggedSample ? (
        <SplitPreviewLayout
          leftTitle="Source tags"
          rightTitle="Normalized schema"
          left={
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ds-muted">{rawTaggedSample}</pre>
          }
          right={editorialPrograms}
        />
      ) : (
        <div className="max-h-[min(520px,60vh)] w-full min-w-0 overflow-y-auto">{editorialPrograms}</div>
      )}
    </div>
  );
}
