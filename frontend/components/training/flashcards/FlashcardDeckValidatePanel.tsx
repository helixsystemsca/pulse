"use client";

import { useRef, useState } from "react";
import { ClipboardCheck, FileJson, Loader2 } from "lucide-react";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  validateTrainingDeck,
  type TrainingDeckValidationReport,
} from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageDescription } from "@/styles/ui-classes";

function IssueList({
  title,
  items,
  tone,
}: {
  title: string;
  items: TrainingDeckValidationReport["errors"];
  tone: "error" | "warning";
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-ds-muted">
        {title}: none
      </p>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">{title} ({items.length})</p>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
        {items.map((item, i) => (
          <li
            key={`${item.path}-${item.code}-${i}`}
            className={cn(
              "rounded-md px-2 py-1.5",
              tone === "error"
                ? "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200"
                : "bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200",
            )}
          >
            <span className="font-mono text-[10px] opacity-80">{item.path}</span>
            <span className="mx-1">·</span>
            <span className="font-semibold">{item.code}</span>
            <span className="mx-1">—</span>
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FlashcardDeckValidatePanel() {
  const validateFileRef = useRef<HTMLInputElement>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<TrainingDeckValidationReport | null>(null);

  const runValidate = async (raw: string) => {
    setValidating(true);
    setError(null);
    try {
      const result = await validateTrainingDeck(raw);
      setReport(result);
    } catch (e) {
      setReport(null);
      setError(parseClientApiError(e).message);
    } finally {
      setValidating(false);
    }
  };

  return (
    <details className="rounded-xl border border-ds-border bg-ds-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ds-foreground [&::-webkit-details-marker]:hidden">
        <ClipboardCheck className="h-4 w-4 text-teal-600" aria-hidden />
        Validate deck (developer tool)
      </summary>
      <div className="space-y-4 border-t border-ds-border px-4 py-4">
        <p className={cn(uiPageDescription, "text-sm")}>
          Check a JSON deck for duplicate questions, missing tags, invalid difficulty, empty sections, and more.
          Validation is read-only — nothing is imported or changed.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ds-border px-3 py-2 text-sm font-semibold hover:bg-ds-muted/20">
            {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
            Choose JSON file
            <input
              ref={validateFileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              disabled={validating}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void file.text().then(runValidate);
                if (validateFileRef.current) validateFileRef.current.value = "";
              }}
            />
          </label>
        </div>

        {error ? <div className={uiCalloutWarning}>{error}</div> : null}

        {report ? (
          <div className="space-y-4 rounded-lg border border-ds-border bg-ds-muted/5 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase",
                  report.status === "valid"
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
                )}
              >
                {report.status}
              </span>
              {report.source_name ? (
                <span className="text-xs text-ds-muted">Source: {report.source_name}</span>
              ) : null}
              {report.version ? (
                <span className="text-xs text-ds-muted">v{report.version}</span>
              ) : null}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Statistics</p>
              <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Courses", report.statistics.courses],
                  ["Sections", report.statistics.sections],
                  ["Flashcards", report.statistics.flashcards],
                  ["With explanation", report.statistics.flashcards_with_explanation],
                  ["Missing explanation", report.statistics.flashcards_missing_explanation],
                  ["With tags", report.statistics.flashcards_with_tags],
                  ["Missing tags", report.statistics.flashcards_missing_tags],
                  ["Empty sections", report.statistics.sections_without_cards],
                  ["Duplicate questions", report.statistics.duplicate_questions],
                  ["Duplicate answers", report.statistics.duplicate_answers],
                  ["Invalid difficulty", report.statistics.invalid_difficulty_count],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-ds-muted">{label}</dt>
                    <dd className="font-semibold text-ds-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <IssueList title="Errors" items={report.errors} tone="error" />
            <IssueList title="Warnings" items={report.warnings} tone="warning" />
          </div>
        ) : null}
      </div>
    </details>
  );
}
