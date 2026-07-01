"use client";

import { AlertTriangle, ArrowRight, Flag, Sparkles, TrendingUp } from "lucide-react";
import type { WorkerDevelopmentSummary } from "@/lib/team-management/development-types";
import {
  QUADRANT_META,
  STATUS_META,
  displayName,
  formatShortDate,
  scorePercent,
} from "@/lib/team-management/development-types";
import { DevelopmentEmployeeAvatar } from "@/components/team-management/performance/components/DevelopmentEmployeeAvatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

function StatusIcon({ status }: { status: WorkerDevelopmentSummary["development_status"] }) {
  const kind = STATUS_META[status].icon;
  const cls = "h-3.5 w-3.5 shrink-0";
  if (kind === "trending") return <TrendingUp className={cls} aria-hidden />;
  if (kind === "sparkles") return <Sparkles className={cls} aria-hidden />;
  if (kind === "alert") return <AlertTriangle className={cls} aria-hidden />;
  return <Flag className={cls} aria-hidden />;
}

function ScoreBar({ label, score, barClass }: { label: string; score: number | null; barClass: string }) {
  const pct = scorePercent(score);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="font-semibold text-ds-muted">{label}</span>
        <span className="font-bold tabular-nums text-ds-foreground">{score != null ? score.toFixed(1) : "—"}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)]">
        <div className={cn("h-full rounded-full transition-all", barClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TeamMemberDevelopmentCard({
  employee,
  onViewProfile,
}: {
  employee: WorkerDevelopmentSummary;
  onViewProfile: (userId: string) => void;
}) {
  const qMeta = QUADRANT_META[employee.development_quadrant];
  const sMeta = STATUS_META[employee.development_status];
  const name = displayName(employee);
  const summary =
    employee.assessment_summary?.trim() ||
    "No assessment summary yet — open the profile to complete an assessment.";

  return (
    <article className="ops-dash-inner-card flex flex-col p-4">
      <div className="flex items-start gap-3">
        <DevelopmentEmployeeAvatar
          avatarUrl={employee.avatar_url}
          fullName={employee.full_name}
          email={employee.email}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-ds-foreground">{name}</h3>
          <p className="truncate text-xs text-ds-muted">{employee.job_title || "—"}</p>
          <span
            className={cn(
              "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
              qMeta.badgeClass,
            )}
          >
            {qMeta.shortLabel} {qMeta.label}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        <ScoreBar label="Performance" score={employee.performance_score} barClass={qMeta.barClass} />
        <ScoreBar label="Potential" score={employee.potential_score} barClass={qMeta.barClass} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <dt className="font-semibold text-ds-muted">Last Review</dt>
          <dd className="mt-0.5 font-medium text-ds-foreground">
            {formatShortDate(employee.last_assessment_at)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ds-muted">Next Review</dt>
          <dd className="mt-0.5 font-medium text-ds-foreground">
            {formatShortDate(employee.next_review_date)}
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
            sMeta.badgeClass,
          )}
        >
          <StatusIcon status={employee.development_status} />
          {sMeta.label}
        </span>
      </div>

      <p className="mt-3 flex-1 text-xs leading-relaxed text-[color-mix(in_srgb,var(--ds-text-primary)_65%,transparent)]">
        {summary}
      </p>

      <Button
        type="button"
        variant="secondary"
        className="mt-4 w-full justify-between text-xs"
        onClick={() => onViewProfile(employee.user_id)}
      >
        View Profile
        <ArrowRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
      </Button>
    </article>
  );
}
