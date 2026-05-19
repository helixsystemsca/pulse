"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen, CheckCircle2, Clock, FileWarning, ShieldCheck, Users } from "lucide-react";
import { useWorkforceQualifications } from "@/components/standards/workforce-training/useWorkforceQualifications";
import { QualificationStatusChip } from "@/components/standards/workforce-training/QualificationStatusChip";

function KpiCard({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "amber" | "rose" | "emerald" | "sky";
  href?: string;
}) {
  const toneClass =
    tone === "rose"
      ? "text-rose-600 dark:text-rose-300"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-300"
        : tone === "emerald"
          ? "text-emerald-600 dark:text-emerald-300"
          : tone === "sky"
            ? "text-sky-600 dark:text-sky-300"
            : "text-ds-foreground";
  const inner = (
    <div className="rounded-xl border border-ds-border bg-ds-card px-4 py-3 transition hover:border-ds-primary/30">
      <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary/40">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function TrainingOverviewDashboard() {
  const {
    loading,
    err,
    expiring,
    expired,
    missingProof,
    pendingVerification,
    compliancePct,
    byWorker,
    coverage,
    registry,
  } = useWorkforceQualifications();

  const criticalGaps = coverage.filter((c) => c.qualified === 0).length;
  const workersWithGaps = byWorker.filter((w) => w.expiredCount > 0 || w.expiringCount > 0).length;

  return (
    <div className="space-y-6">
      {loading ? <p className="text-sm text-ds-muted">Loading workforce qualification metrics…</p> : null}
      {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Expiring (60d)" value={expiring.length} tone="amber" href="/standards/training/expiring" />
        <KpiCard label="Expired" value={expired.length} tone="rose" href="/standards/training/expiring" />
        <KpiCard label="Missing proof" value={missingProof.length} tone="amber" href="/standards/training/expiring" />
        <KpiCard label="Pending verification" value={pendingVerification.length} tone="sky" href="/standards/training/expiring" />
        <KpiCard label="Compliance %" value={`${compliancePct}%`} tone="emerald" href="/standards/training/compliance" />
        <KpiCard label="Registry codes" value={registry.length} tone="neutral" href="/standards/training/certifications" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-ds-border bg-ds-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ds-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
            Operational alerts
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span className="text-ds-muted">Workers with qualification gaps</span>
              <span className="font-semibold text-ds-foreground">{workersWithGaps}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-ds-muted">Certifications with zero qualified holders</span>
              <span className="font-semibold text-ds-foreground">{criticalGaps}</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-ds-muted">
            Scheduling eligibility and project staffing validation will consume these signals — integration placeholder.
          </p>
        </section>

        <section className="rounded-xl border border-ds-border bg-ds-card p-4">
          <h3 className="text-sm font-bold text-ds-foreground">Quick actions</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/standards/training/workers"
              className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-muted/20 px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-muted/40"
            >
              <Users className="h-4 w-4" aria-hidden />
              Review workers
            </Link>
            <Link
              href="/standards/training/compliance"
              className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-muted/20 px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-muted/40"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Compliance matrix
            </Link>
            <Link
              href="/standards/procedures"
              className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-muted/20 px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-muted/40"
            >
              <BookOpen className="h-4 w-4" aria-hidden />
              Procedure training
            </Link>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-ds-border bg-ds-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ds-foreground">Priority queue</h3>
          <Link href="/standards/training/expiring" className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300">
            View all →
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-ds-border/60">
          {[...expired, ...expiring].slice(0, 8).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium text-ds-foreground">{r.workerName}</p>
                <p className="text-xs text-ds-muted">
                  {r.registryCode} — {r.label}
                </p>
              </div>
              <QualificationStatusChip
                kind="severity"
                value={r.competencyState === "expired" ? "expired" : "expiring"}
              />
            </li>
          ))}
          {expired.length + expiring.length === 0 ? (
            <li className="py-6 text-center text-sm text-ds-muted">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" aria-hidden />
              No urgent certification expirations in the current window.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-xl border border-dashed border-ds-border bg-ds-muted/10 p-4 text-sm text-ds-muted">
        <p className="font-semibold text-ds-foreground">Staffing readiness (foundation)</p>
        <p className="mt-1">
          Future: qualification-aware scheduling, PTO impact validation, and project role coverage will surface here using
          the same worker and registry data.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-ds-card px-2 py-1 text-xs ring-1 ring-ds-border">
            <Clock className="h-3 w-3" aria-hidden /> Scheduler integration
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-ds-card px-2 py-1 text-xs ring-1 ring-ds-border">
            <FileWarning className="h-3 w-3" aria-hidden /> Audit exports
          </span>
        </div>
      </section>
    </div>
  );
}
