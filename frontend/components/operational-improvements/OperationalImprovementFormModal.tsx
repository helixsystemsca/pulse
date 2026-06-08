"use client";

import { useEffect, useMemo, useState } from "react";
import { PremiumModal } from "@/components/ui/premium-modal";
import { PrioritizationPanel } from "@/components/operational-improvements/PrioritizationPanel";
import type { OperationalImprovementCreateInput } from "@/lib/operational-improvements/types";
import { OI_CATEGORIES } from "@/lib/operational-improvements/types";
import { CATEGORY_LABELS, PRIORITY_LABELS } from "@/lib/operational-improvements/labels";
import {
  IMPROVEMENT_TEMPLATES,
  buildFrameworkFromTemplate,
  getImprovementTemplate,
  type ImprovementTemplateId,
} from "@/lib/operational-improvements/templates";
import type { PrioritizationScores } from "@/lib/operational-improvements/prioritization";
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
  const [step, setStep] = useState<"template" | "details">("template");
  const [templateId, setTemplateId] = useState<ImprovementTemplateId>("general");
  const [answers, setAnswers] = useState<Record<string, string>>({});
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
  const [prioritization, setPrioritization] = useState<PrioritizationScores>({ impact: 3, effort: 3, risk: 3 });

  const template = useMemo(() => getImprovementTemplate(templateId), [templateId]);

  useEffect(() => {
    if (!open) return;
    setStep("template");
    setTemplateId("general");
    setAnswers({});
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
    setPrioritization({ impact: 3, effort: 3, risk: 3 });
  }, [open]);

  useEffect(() => {
    if (!template) return;
    setCategory(template.category);
    const symptomQ = template.questions.find((q) => q.id === "symptom");
    if (symptomQ && answers.symptom && !title) {
      setTitle(answers.symptom.slice(0, 120));
    }
    if (answers.symptom) setCurrentSymptoms(answers.symptom);
    if (answers.impact) setEstimatedImpact(answers.impact);
  }, [template, answers, title]);

  async function handleSubmit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const framework = buildFrameworkFromTemplate(templateId, answers, prioritization);
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
        framework_data: framework,
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
      subtitle={step === "template" ? "Pick a template to guide analysis and metrics." : template?.guidanceIntro}
      onClose={onClose}
      footer={
        <div className="flex justify-between gap-2">
          {step === "details" ? (
            <button type="button" className={SECONDARY} disabled={busy} onClick={() => setStep("template")}>
              Back
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className={SECONDARY} disabled={busy} onClick={onClose}>
              Cancel
            </button>
            {step === "template" ? (
              <button type="button" className={PRIMARY} onClick={() => setStep("details")}>
                Continue
              </button>
            ) : (
              <button type="button" className={PRIMARY} disabled={busy || !title.trim()} onClick={() => void handleSubmit()}>
                {busy ? "Saving…" : "Save opportunity"}
              </button>
            )}
          </div>
        </div>
      }
    >
      {step === "template" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {IMPROVEMENT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                templateId === t.id ? "border-ds-accent bg-ds-accent/5" : "border-ds-border hover:border-ds-accent/40",
              )}
            >
              <p className="font-semibold text-ds-foreground">{t.label}</p>
              <p className="mt-1 text-xs text-ds-muted">{t.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {template ? (
            <div className="rounded-lg border border-ds-border bg-ds-secondary/40 p-3">
              <p className="text-sm font-semibold text-ds-foreground">{template.label}</p>
              <p className="mt-1 text-xs text-ds-muted">
                Recommended: {template.recommendedAnalyses.join(", ")} · Metrics: {template.suggestedMetrics.join(", ")}
              </p>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {template?.questions.map((q) => (
              <div key={q.id} className={q.multiline ? "sm:col-span-2" : ""}>
                <label className={LABEL}>{q.label}</label>
                {q.multiline ? (
                  <textarea
                    className={cn(FIELD, "min-h-[72px]")}
                    value={answers[q.id] ?? ""}
                    placeholder={q.placeholder}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                ) : (
                  <input
                    className={FIELD}
                    value={answers[q.id] ?? ""}
                    placeholder={q.placeholder}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="oi-title">
                Title
              </label>
              <input id="oi-title" className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="oi-dept">
                Department
              </label>
              <input id="oi-dept" className={FIELD} value={departmentSlug} onChange={(e) => setDepartmentSlug(e.target.value)} />
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
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="oi-stakeholders">
                Stakeholders affected
              </label>
              <textarea id="oi-stakeholders" className={cn(FIELD, "min-h-[72px]")} value={stakeholdersAffected} onChange={(e) => setStakeholdersAffected(e.target.value)} />
            </div>
          </div>
          <PrioritizationPanel value={prioritization} onSave={async (scores) => setPrioritization(scores)} />
        </div>
      )}
    </PremiumModal>
  );
}
