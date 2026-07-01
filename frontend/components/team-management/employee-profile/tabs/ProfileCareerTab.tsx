"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { dsInputClass, dsInputStackedClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { useEmployeeProfileContext } from "@/components/team-management/employee-profile/EmployeeProfileContext";
import { cn } from "@/lib/cn";

export function ProfileCareerTab() {
  const { profile, save, saving, reload } = useEmployeeProfileContext();
  const [draft, setDraft] = useState(profile?.development.career ?? {});
  const [goals, setGoals] = useState(profile?.development.career_goals ?? "");

  if (!profile) return null;
  const c = profile.development.career ?? {};

  const onSave = async () => {
    await save({ career: draft, career_goals: goals });
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["desired_position", "Desired Position"],
            ["leadership_interest", "Leadership Interest"],
            ["promotion_readiness", "Promotion Readiness"],
            ["mentor_name", "Mentor"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label className={dsLabelClass}>{label}</label>
            <input
              className={dsInputStackedClass}
              value={(draft[key] as string) || ""}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div>
        <label className={dsLabelClass}>Career Goals</label>
        <textarea
          className={cn(dsInputStackedClass, "resize-y")}
          rows={3}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
        />
      </div>
      <div>
        <label className={dsLabelClass}>Career Notes</label>
        <textarea
          className={cn(dsInputStackedClass, "resize-y")}
          rows={4}
          value={draft.career_notes || ""}
          onChange={(e) => setDraft({ ...draft, career_notes: e.target.value })}
        />
      </div>
      <Button type="button" className="h-9 text-xs" disabled={saving} onClick={() => void onSave()}>
        Save Career
      </Button>
      <p className="text-xs text-ds-muted">Succession planning — structured for future integration.</p>
      <div className="ops-dash-inner-card border-dashed p-3 text-xs text-ds-muted">
        Current snapshot: {c.promotion_readiness || "Not assessed"} · Mentor: {c.mentor_name || "—"}
      </div>
    </div>
  );
}
