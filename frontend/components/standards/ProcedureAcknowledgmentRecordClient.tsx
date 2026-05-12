"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import {
  fetchProcedureAcknowledgmentComplianceRecord,
  fetchProcedureAcknowledgmentPdfBlob,
  type ProcedureAcknowledgmentComplianceRecord,
} from "@/lib/procedureAcknowledgmentsArchiveApi";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { procedureStepDisplayText, type ProcedureStep } from "@/lib/cmmsApi";
import { Button } from "@/components/ui/Button";

function stepTypeLabel(step: unknown): string {
  if (typeof step !== "object" || step === null) return "instruction";
  const t = String((step as { type?: string }).type || "").trim().toLowerCase();
  if (t === "checklist" || t === "photo" || t === "warning") return t;
  return "instruction";
}

export function ProcedureAcknowledgmentRecordClient({ acknowledgmentId }: { acknowledgmentId: string }) {
  const [rec, setRec] = useState<ProcedureAcknowledgmentComplianceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchProcedureAcknowledgmentComplianceRecord(acknowledgmentId);
      setRec(r);
    } catch (e) {
      setErr(parseClientApiError(e).message);
      setRec(null);
    } finally {
      setLoading(false);
    }
  }, [acknowledgmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPdf = useCallback(
    async (download: boolean) => {
      setPdfBusy(true);
      try {
        const blob = await fetchProcedureAcknowledgmentPdfBlob(acknowledgmentId, download);
        const url = URL.createObjectURL(blob);
        if (download) {
          const a = document.createElement("a");
          a.href = url;
          a.download = `procedure-acknowledgment-${acknowledgmentId}.pdf`;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
          window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
        }
      } catch (e) {
        setErr(parseClientApiError(e).message);
      } finally {
        setPdfBusy(false);
      }
    },
    [acknowledgmentId],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-ds-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading compliance record…
      </div>
    );
  }

  if (err || !rec) {
    return (
      <div className="space-y-4">
        <Link
          href="/standards/acknowledgments"
          className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-secondary/50 px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-secondary/70 dark:border-ds-border"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to archive
        </Link>
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
          {err ?? "Record not found."}
        </p>
      </div>
    );
  }

  const steps = Array.isArray(rec.procedure_content_snapshot) ? rec.procedure_content_snapshot : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/standards/acknowledgments"
          className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-secondary/50 px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-secondary/70 dark:border-ds-border"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Archive
        </Link>
      </div>

      <div className="rounded-lg border border-ds-border bg-ds-secondary/25 px-4 py-3 text-sm text-ds-foreground dark:border-ds-border dark:bg-ds-secondary/30">
        <p className="font-semibold">Historical snapshot (immutable)</p>
        <p className="mt-1 text-ds-muted">
          This page and the stored PDF reflect the procedure version and content at acknowledgment time. They are not
          updated when the live procedure is edited.
        </p>
      </div>

      <section className="rounded-xl border border-ds-border/90 bg-ds-primary p-5 shadow-sm dark:border-ds-border dark:bg-ds-secondary/30">
        <h1 className="text-lg font-bold text-ds-foreground">Acknowledgment compliance record</h1>
        <dl className="mt-4 grid gap-3 text-sm">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Archive reference</dt>
            <dd className="font-mono text-xs text-ds-foreground">{rec.snapshot_id}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Procedure (snapshot)</dt>
            <dd className="text-ds-foreground">{rec.procedure_title_snapshot}</dd>
            <dd className="mt-0.5 font-mono text-xs text-ds-muted">{rec.procedure_id}</dd>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Category</dt>
              <dd className="text-ds-foreground">{rec.procedure_category_snapshot ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Revision (snapshot)</dt>
              <dd className="tabular-nums text-ds-foreground">
                {rec.procedure_version_snapshot}
                {rec.procedure_semantic_version_snapshot ? ` · ${rec.procedure_semantic_version_snapshot}` : ""}
              </dd>
            </div>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Version status</dt>
            <dd className="text-ds-foreground">
              {rec.compliance_status === "current" ? (
                <span>Acknowledged revision matches or exceeds current catalog revision ({rec.procedure_current_revision}).</span>
              ) : (
                <span>
                  Catalog has moved ahead (current revision {rec.procedure_current_revision}); this acknowledgment remains
                  valid as a historical record for revision {rec.procedure_version_snapshot}.
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Worker</dt>
            <dd className="text-ds-foreground">{rec.worker_full_name ?? "—"}</dd>
            <dd className="text-xs text-ds-muted">
              {[rec.worker_job_title, rec.worker_operational_role].filter(Boolean).join(" · ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Acknowledged at</dt>
            <dd className="tabular-nums text-ds-foreground">{new Date(rec.acknowledged_at).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-ds-border/90 bg-ds-primary p-5 shadow-sm dark:border-ds-border dark:bg-ds-secondary/30">
        <h2 className="text-sm font-bold text-ds-foreground">PDF</h2>
        <p className="mt-1 text-xs text-ds-muted">
          PDFs are generated asynchronously after acknowledgment. Refresh if the document is still processing.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={!rec.generated_pdf_ready || pdfBusy} onClick={() => void openPdf(false)}>
            <FileText className="h-4 w-4" aria-hidden />
            View PDF
          </Button>
          <Button type="button" variant="secondary" disabled={!rec.generated_pdf_ready || pdfBusy} onClick={() => void openPdf(true)}>
            Download PDF
          </Button>
          <Button type="button" variant="secondary" disabled title="Email delivery will be available in a future release.">
            Email PDF
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-ds-muted">Printing: open the PDF, then use your browser or PDF viewer Print command.</p>
        {rec.pdf_generation_error ? (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400" role="status">
            Last generation error: {rec.pdf_generation_error}
          </p>
        ) : !rec.generated_pdf_ready ? (
          <p className="mt-3 text-xs text-ds-muted" role="status">
            PDF not ready yet.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-ds-border/90 bg-ds-primary p-5 shadow-sm dark:border-ds-border dark:bg-ds-secondary/30">
        <h2 className="text-sm font-bold text-ds-foreground">Acknowledgment statement</h2>
        <blockquote className="mt-3 border-l-2 border-ds-border pl-4 text-sm italic text-ds-foreground dark:border-ds-border">
          {rec.acknowledgment_statement_text}
        </blockquote>
        {rec.acknowledgment_note ? (
          <p className="mt-3 text-xs text-ds-muted">
            <span className="font-semibold text-ds-foreground">Note: </span>
            {rec.acknowledgment_note}
          </p>
        ) : null}
      </section>

      {rec.procedure_revision_summary_snapshot ? (
        <section className="rounded-xl border border-ds-border/90 bg-ds-primary p-5 shadow-sm dark:border-ds-border dark:bg-ds-secondary/30">
          <h2 className="text-sm font-bold text-ds-foreground">Revision summary (snapshot)</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ds-foreground">{rec.procedure_revision_summary_snapshot}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-ds-border/90 bg-ds-primary p-5 shadow-sm dark:border-ds-border dark:bg-ds-secondary/30">
        <h2 className="text-sm font-bold text-ds-foreground">Procedure content (snapshot preview)</h2>
        <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm text-ds-foreground">
          {steps.length === 0 ? <li className="text-ds-muted">No steps on record.</li> : null}
          {steps.map((step, i) => {
            const st = stepTypeLabel(step);
            const body = procedureStepDisplayText(step as string | ProcedureStep);
            return (
              <li key={i} className="pl-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">{st}</span>
                <p className="mt-1 whitespace-pre-wrap">{body || "—"}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
