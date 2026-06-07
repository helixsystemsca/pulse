"use client";

import { useEffect, useState } from "react";
import { PremiumModal } from "@/components/ui/premium-modal";
import type { OperationalImprovementCreateInput } from "@/lib/operational-improvements/types";
import { OI_CATEGORIES } from "@/lib/operational-improvements/types";
import { CATEGORY_LABELS, PRIORITY_LABELS } from "@/lib/operational-improvements/labels";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-primary dark:text-ds-foreground";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2 text-sm font-bold");
const SECONDARY = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2 text-sm font-semibold");

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: OperationalImprovementCreateInput) => Promise<void>;
};

export function OperationalImprovementFormModal({ open, onClose, onSubmit }: Props) {
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [departmentSlug, setDepartmentSlug] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<OperationalImprovementCreateInput["priority"]>("medium");
  const [category, setCategory] = useState<OperationalImprovementCreateInput["category"]>("other");
  const [estimatedImpact, setEstimatedImpact] = useState("");
  const [currentSymptoms, setCurrentSymptoms] = useState("");
  const [stakeholdersAffected, setStakeholdersAffected] = useState("");
  const [dateIdentified, setDateIdentified] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setDepartmentSlug("");
    setLocation("");
    setPriority("medium");
    setCategory("other");
    setEstimatedImpact("");
    setCurrentSymptoms("");
    setStakeholdersAffected("");
    setDateIdentified(new Date().toISOString().slice(0, 10));
  }, [open]);

  async function handleSubmit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        department_slug: departmentSlug.trim() || undefined,
        location: location.trim() || undefined,
        date_identified: dateIdentified || undefined,
        priority,
        category,
        estimated_impact: estimatedImpact.trim() || undefined,
        current_symptoms: currentSymptoms.trim() || undefined,
        stakeholders_affected: stakeholdersAffected.trim() || undefined,
        status: "identified",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PremiumModal
      open={open}
      size="lg"
      title="Log improvement opportunity"
      subtitle="Capture operational friction before analysis — not a project or work order."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={PRIMARY} disabled={busy || !title.trim()} onClick={() => void handleSubmit()}>
            {busy ? "Saving…" : "Save opportunity"}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="oi-title">
            Title
          </label>
          <input id="oi-title" className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="oi-desc">
            Description
          </label>
          <textarea id="oi-desc" className={cn(FIELD, "min-h-[88px]")} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="oi-dept">
            Department
          </label>
          <input id="oi-dept" className={FIELD} value={departmentSlug} onChange={(e) => setDepartmentSlug(e.target.value)} placeholder="e.g. aquatics" />
        </div>
        <div>
          <label className={LABEL} htmlFor="oi-loc">
            Location
          </label>
          <input id="oi-loc" className={FIELD} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="oi-date">
            Date identified
          </label>
          <input id="oi-date" type="date" className={FIELD} value={dateIdentified} onChange={(e) => setDateIdentified(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="oi-priority">
            Priority
          </label>
          <select id="oi-priority" className={FIELD} value={priority} onChange={(e) => setPriority(e.target.value as OperationalImprovementCreateInput["priority"])}>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="oi-category">
            Category
          </label>
          <select id="oi-category" className={FIELD} value={category} onChange={(e) => setCategory(e.target.value as OperationalImprovementCreateInput["category"])}>
            {OI_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="oi-impact">
            Estimated impact
          </label>
          <input id="oi-impact" className={FIELD} value={estimatedImpact} onChange={(e) => setEstimatedImpact(e.target.value)} placeholder="Time saved, cost, safety…" />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="oi-symptoms">
            Current symptoms
          </label>
          <textarea id="oi-symptoms" className={cn(FIELD, "min-h-[72px]")} value={currentSymptoms} onChange={(e) => setCurrentSymptoms(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="oi-stakeholders">
            Stakeholders affected
          </label>
          <textarea id="oi-stakeholders" className={cn(FIELD, "min-h-[72px]")} value={stakeholdersAffected} onChange={(e) => setStakeholdersAffected(e.target.value)} />
        </div>
      </div>
    </PremiumModal>
  );
}
