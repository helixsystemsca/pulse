"use client";

import { useEffect, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import { useAsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import {
  PLANNING_IDEA_PRIORITIES,
  PLANNING_IDEA_STATUSES,
  type PlanningIdeaRow,
  type PlanningIdeaStatus,
} from "@/lib/planning-ideas/types";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/planning-ideas/labels";

const FIELD =
  "mt-1.5 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ds-accent/30";

type Props = {
  open: boolean;
  idea: PlanningIdeaRow | null;
  onClose: () => void;
  onSave: (draft: {
    title: string;
    description: string;
    location: string;
    category: string;
    estimated_cost: number | null;
    priority: string;
    status: PlanningIdeaStatus;
  }) => Promise<void>;
};

export function PlanningIdeaFormModal({ open, idea, onClose, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [cost, setCost] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState<PlanningIdeaStatus>("idea");
  const { phase: submitPhase, run: runSubmit } = useAsyncSubmitPhase();
  const submitPending = submitPhase === "loading" || submitPhase === "success";
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(idea?.title ?? "");
    setDescription(idea?.description ?? "");
    setLocation(idea?.location ?? "");
    setCategory(idea?.category ?? "");
    const c = idea?.estimated_cost;
    setCost(c != null && c !== "" ? String(c) : "");
    setPriority(idea?.priority ?? "medium");
    setStatus(idea?.status === "converted" ? "converted" : (idea?.status ?? "idea"));
    setErr(null);
  }, [open, idea]);

  if (!open) return null;

  const editableStatuses = PLANNING_IDEA_STATUSES.filter((s) => s !== "converted");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitPending) return;
    setErr(null);
    try {
      await runSubmit(async () => {
        const parsed = cost.trim() ? Number.parseFloat(cost.replace(/,/g, "")) : null;
        await onSave({
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          category: category.trim(),
          estimated_cost: parsed != null && Number.isFinite(parsed) ? parsed : null,
          priority,
          status: idea?.status === "converted" ? "converted" : status,
        });
      });
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not save.");
    }
  }

  return (
    <PulseDrawer
      open={open}
      title={idea ? "Edit idea" : "Add idea"}
      subtitle="Capture a project concept before it enters the formal portfolio."
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold text-ds-muted" onClick={onClose}>
            Cancel
          </button>
          <AsyncSubmitButton
            type="submit"
            form="planning-idea-form"
            phase={submitPhase}
            idleLabel="Save"
            loadingLabel="Saving"
            disabled={submitPending || !title.trim() || idea?.status === "converted"}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
          />
        </div>
      }
    >
      <form id="planning-idea-form" className="space-y-4" onSubmit={(e) => void submit(e)}>
        {err ? <p className="text-sm text-ds-danger">{err}</p> : null}
        <div>
          <label className="text-xs font-semibold uppercase text-ds-muted">Title</label>
          <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-ds-muted">Description</label>
          <textarea className={`${FIELD} min-h-[100px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase text-ds-muted">Location</label>
            <input className={FIELD} value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-ds-muted">Category</label>
            <input className={FIELD} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase text-ds-muted">Rough cost (USD)</label>
            <input
              className={FIELD}
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="250000"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-ds-muted">Priority</label>
            <select className={FIELD} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PLANNING_IDEA_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-ds-muted">Status</label>
            <select
              className={FIELD}
              value={status}
              disabled={idea?.status === "converted"}
              onChange={(e) => setStatus(e.target.value as PlanningIdeaStatus)}
            >
              {editableStatuses.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
              {idea?.status === "converted" ? <option value="converted">{STATUS_LABELS.converted}</option> : null}
            </select>
          </div>
        </div>
      </form>
    </PulseDrawer>
  );
}
