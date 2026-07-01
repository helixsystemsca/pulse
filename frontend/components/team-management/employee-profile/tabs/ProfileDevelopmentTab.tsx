"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { dsInputStackedClass, dsLabelClass, dsSelectClass } from "@/components/ui/ds-form-classes";
import { useEmployeeProfileContext } from "@/components/team-management/employee-profile/EmployeeProfileContext";
import type { DevelopmentQuadrant } from "@/lib/team-management/development-types";
import { QUADRANT_META, formatShortDate } from "@/lib/team-management/development-types";
import { cn } from "@/lib/cn";

export function ProfileDevelopmentTab() {
  const { profile, save, saving, reload } = useEmployeeProfileContext();
  const [quadrant, setQuadrant] = useState<DevelopmentQuadrant | null>(null);
  const [planNotes, setPlanNotes] = useState("");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  if (!profile) return null;
  const d = profile.development;
  const currentQ = quadrant ?? d.development_quadrant;
  const pct = d.plan_completion_pct ?? 0;

  const onQuadrantSave = async () => {
    if (!quadrant || quadrant === d.development_quadrant) return;
    const res = await save({
      development_quadrant: quadrant,
      confirm_plan_overwrite: confirmOverwrite,
    });
    if (res.planOverwriteRequired) {
      setConfirmOverwrite(true);
      return;
    }
    setQuadrant(null);
    setConfirmOverwrite(false);
    await reload();
  };

  const onPlanSave = async () => {
    await save({
      development_plan: { ...d.development_plan, custom_notes: planNotes },
    });
    await reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={dsLabelClass} htmlFor="dev-q">
            Current Quadrant
          </label>
          <select
            id="dev-q"
            className={cn(dsSelectClass, "mt-1.5 min-w-[12rem]")}
            value={currentQ}
            onChange={(e) => setQuadrant(e.target.value as DevelopmentQuadrant)}
          >
            {(Object.keys(QUADRANT_META) as DevelopmentQuadrant[]).map((q) => (
              <option key={q} value={q}>
                {q} – {QUADRANT_META[q].label}
              </option>
            ))}
          </select>
        </div>
        {quadrant && quadrant !== d.development_quadrant ? (
          <Button type="button" className="h-9 text-xs" disabled={saving} onClick={() => void onQuadrantSave()}>
            {confirmOverwrite ? "Confirm Plan Replace" : "Apply Quadrant"}
          </Button>
        ) : null}
      </div>

      {confirmOverwrite ? (
        <p className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Changing quadrant will replace the development plan and timeline. Confirm to continue.
        </p>
      ) : null}

      <div className="ops-dash-inner-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-ds-foreground">{d.development_plan.objective || "Development Plan"}</p>
          <span className="text-xs font-bold tabular-nums text-[var(--ds-accent)]">{pct}% complete</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ds-border/40">
          <div className="h-full rounded-full bg-[var(--ds-accent)]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {(["30", "60", "90"] as const).map((window) => {
        const items = d.development_plan.milestones?.[window] || [];
        return (
          <section key={window}>
            <h3 className="text-xs font-bold uppercase text-ds-muted">{window}-Day Milestones</h3>
            <ul className="mt-2 space-y-1">
              {items.map((item) => (
                <li key={item} className="rounded-lg border border-ds-border/50 px-3 py-2 text-sm">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section>
        <h3 className="text-xs font-bold uppercase text-ds-muted">Timeline</h3>
        <ul className="mt-2 space-y-2">
          {d.timeline.map((item) => (
            <li key={item.id} className="flex justify-between gap-2 rounded-lg border border-ds-border/50 px-3 py-2 text-sm">
              <span>
                {item.title}
                <span className="ml-2 text-xs text-ds-muted">({item.status})</span>
              </span>
              <time className="text-xs tabular-nums text-ds-muted">{formatShortDate(item.scheduled_date)}</time>
            </li>
          ))}
        </ul>
      </section>

      <div>
        <label className={dsLabelClass}>Manager Comments / Plan Notes</label>
        <textarea
          className={cn(dsInputStackedClass, "resize-y")}
          rows={3}
          value={planNotes || d.development_plan.custom_notes || ""}
          onChange={(e) => setPlanNotes(e.target.value)}
        />
        <Button type="button" variant="secondary" className="mt-2 h-8 text-xs" disabled={saving} onClick={() => void onPlanSave()}>
          Save Plan Notes
        </Button>
      </div>
    </div>
  );
}
