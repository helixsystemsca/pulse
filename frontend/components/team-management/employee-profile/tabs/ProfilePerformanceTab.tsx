"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { dsInputStackedClass, dsLabelClass, dsSelectClass } from "@/components/ui/ds-form-classes";
import { useEmployeeProfileContext } from "@/components/team-management/employee-profile/EmployeeProfileContext";
import { overallRating } from "@/lib/team-management/employee-profile/types";
import { QUADRANT_META, formatShortDate } from "@/lib/team-management/development-types";
import { cn } from "@/lib/cn";
import type { DevelopmentAssessment } from "@/lib/team-management/development-types";

const SCORE_FIELDS: { key: keyof DevelopmentAssessment; label: string }[] = [
  { key: "initiative", label: "Initiative" },
  { key: "communication", label: "Communication" },
  { key: "leadership_potential", label: "Leadership" },
  { key: "reliability", label: "Reliability" },
  { key: "technical_skills", label: "Technical Skill" },
];

export function ProfilePerformanceTab() {
  const { profile, save, saving, reload } = useEmployeeProfileContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DevelopmentAssessment | null>(null);
  const [managerNotes, setManagerNotes] = useState("");
  const [planOverwrite, setPlanOverwrite] = useState(false);

  if (!profile) return null;
  const d = profile.development;
  const rating = overallRating(d.assessment);

  const startEdit = () => {
    setDraft({ ...d.assessment });
    setManagerNotes(d.manager_notes || "");
    setEditing(true);
  };

  const onSave = async () => {
    if (!draft) return;
    await save({
      assessment: draft,
      manager_notes: managerNotes,
      record_assessment: true,
      confirm_plan_overwrite: planOverwrite,
    });
    setEditing(false);
    setPlanOverwrite(false);
    await reload();
  };

  const quadrantHistory = (d.history ?? []).filter((h) => h.kind === "quadrant_change");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ds-foreground">Performance Summary</p>
          <p className="text-xs text-ds-muted">{d.assessment.overall_summary || "No summary yet."}</p>
        </div>
        {!editing ? (
          <Button type="button" variant="secondary" className="h-8 text-xs" onClick={startEdit}>
            Edit Assessment
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="h-8 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="button" className="h-8 text-xs" disabled={saving} onClick={() => void onSave()}>
              Save Assessment
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="ops-dash-inner-card p-3">
          <p className="text-[10px] font-bold uppercase text-ds-muted">Current Quadrant</p>
          <p className="mt-1 text-sm font-bold text-ds-foreground">
            {QUADRANT_META[d.development_quadrant].label}
          </p>
        </div>
        <div className="ops-dash-inner-card p-3">
          <p className="text-[10px] font-bold uppercase text-ds-muted">Overall Rating</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ds-foreground">{rating ?? "—"}</p>
        </div>
      </div>

      {editing && draft ? (
        <div className="space-y-3 rounded-lg border border-ds-border/60 p-4">
          {(
            [
              ["strengths", "Strengths"],
              ["development_areas", "Development Areas"],
              ["overall_summary", "Overall Summary"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className={dsLabelClass}>{label}</label>
              <textarea
                className={cn(dsInputStackedClass, "resize-y")}
                rows={2}
                value={draft[key] || ""}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            {SCORE_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className={dsLabelClass}>{label}</label>
                <select
                  className={cn(dsSelectClass, "mt-1.5")}
                  value={draft[key] ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label className={dsLabelClass}>Manager Notes</label>
            <textarea
              className={cn(dsInputStackedClass, "resize-y")}
              rows={3}
              value={managerNotes}
              onChange={(e) => setManagerNotes(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className={dsLabelClass}>Strengths</p>
              <p className="mt-1 text-sm text-ds-foreground">{d.assessment.strengths || "—"}</p>
            </div>
            <div>
              <p className={dsLabelClass}>Development Areas</p>
              <p className="mt-1 text-sm text-ds-foreground">{d.assessment.development_areas || "—"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SCORE_FIELDS.map(({ key, label }) => (
              <div key={key} className="ops-dash-inner-card px-3 py-2">
                <p className="text-[10px] font-semibold text-ds-muted">{label}</p>
                <p className="text-lg font-bold tabular-nums">{d.assessment[key] ?? "—"}</p>
              </div>
            ))}
          </div>
          <div>
            <p className={dsLabelClass}>Manager Notes</p>
            <p className="mt-1 text-sm text-ds-foreground">{d.manager_notes || "—"}</p>
          </div>
        </>
      )}

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">Assessment History</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {(d.history ?? [])
            .filter((h) => h.kind === "assessment")
            .map((h) => (
              <li key={h.id} className="flex justify-between gap-2 border-b border-ds-border/40 py-1.5">
                <span>{h.summary}</span>
                <time className="text-xs text-ds-muted">{formatShortDate(h.at)}</time>
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">Quadrant History</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {quadrantHistory.length === 0 ? (
            <li className="text-ds-muted">No quadrant changes recorded.</li>
          ) : (
            quadrantHistory.map((h) => (
              <li key={h.id} className="flex justify-between gap-2 border-b border-ds-border/40 py-1.5">
                <span>{h.summary}</span>
                <time className="text-xs text-ds-muted">{formatShortDate(h.at)}</time>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
