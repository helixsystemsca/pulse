"use client";

import {
  QUADRANT_META,
  STATUS_META,
  displayName,
  formatShortDate,
} from "@/lib/team-management/development-types";
import { yearsOfService } from "@/lib/team-management/employee-profile/types";
import { DevelopmentEmployeeAvatar } from "@/components/team-management/performance/components/DevelopmentEmployeeAvatar";
import { ProfileFieldRow, ProfileStatCard } from "@/components/team-management/employee-profile/shared/ProfileFieldRow";
import { useEmployeeProfileContext } from "@/components/team-management/employee-profile/EmployeeProfileContext";

export function ProfileOverviewTab() {
  const { profile } = useEmployeeProfileContext();
  if (!profile) return null;
  const { development: d, worker, training } = profile;
  const qMeta = QUADRANT_META[d.development_quadrant];
  const certs = worker?.certifications ?? [];
  const completedTraining = training?.assignments.filter((a) => a.status === "completed").length ?? 0;
  const recognitionCount = d.recognitions?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <DevelopmentEmployeeAvatar
          avatarUrl={d.avatar_url}
          fullName={d.full_name}
          email={d.email}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ds-foreground">{displayName(d)}</h2>
          <p className="text-sm text-ds-muted">{d.job_title || "—"}</p>
          <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${qMeta.badgeClass}`}>
            {qMeta.shortLabel} · {qMeta.label}
          </span>
        </div>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ProfileFieldRow label="Department" value={d.department} />
        <ProfileFieldRow label="Manager" value={d.supervisor_name} />
        <ProfileFieldRow label="Hire Date" value={formatShortDate(d.start_date)} />
        <ProfileFieldRow label="Years of Service" value={yearsOfService(d.start_date)} />
        <ProfileFieldRow label="Development Status" value={STATUS_META[d.development_status].label} />
        <ProfileFieldRow label="Last Assessment" value={formatShortDate(d.last_assessment_at)} />
        <ProfileFieldRow label="Next Review" value={formatShortDate(d.next_review_date)} />
        <ProfileFieldRow label="Career Goal" value={d.career_goals || d.career?.career_notes || "—"} />
        <ProfileFieldRow label="Development Objective" value={d.development_plan.objective || "—"} />
      </dl>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Current Certifications</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {certs.length === 0 ? (
            <span className="text-sm text-ds-muted">—</span>
          ) : (
            certs.map((c) => (
              <span key={c.id} className="rounded-full border border-ds-border px-2 py-0.5 text-[10px] font-semibold">
                {c.name}
                {c.expiry_date ? ` · exp ${formatShortDate(c.expiry_date)}` : ""}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProfileStatCard label="Training Completed" value={completedTraining} />
        <ProfileStatCard label="Recognition" value={recognitionCount} />
        <ProfileStatCard label="Plan Progress" value={`${d.plan_completion_pct ?? 0}%`} />
        <ProfileStatCard
          label="Performance"
          value={d.performance_score != null ? d.performance_score.toFixed(1) : "—"}
        />
      </div>

      <div className="ops-dash-inner-card p-4">
        <p className="text-xs font-bold text-ds-foreground">Active Development Plan</p>
        <p className="mt-1 text-sm text-ds-muted">{d.development_plan.objective || "No plan objective set."}</p>
        <p className="mt-2 text-xs text-ds-muted">
          Assigned equipment integration — coming soon.
        </p>
      </div>
    </div>
  );
}
