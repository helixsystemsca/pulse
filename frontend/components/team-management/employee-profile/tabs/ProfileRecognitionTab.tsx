"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { dsInputStackedClass, dsLabelClass, dsSelectClass } from "@/components/ui/ds-form-classes";
import { useEmployeeProfileContext } from "@/components/team-management/employee-profile/EmployeeProfileContext";
import { formatShortDate } from "@/lib/team-management/development-types";
import { cn } from "@/lib/cn";

const CATEGORIES = [
  { value: "customer_service", label: "Customer Service" },
  { value: "innovation", label: "Innovation" },
  { value: "leadership", label: "Leadership" },
  { value: "safety", label: "Safety" },
  { value: "teamwork", label: "Teamwork" },
  { value: "other", label: "Other" },
];

export function ProfileRecognitionTab() {
  const { profile, save, saving, reload } = useEmployeeProfileContext();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("teamwork");

  if (!profile) return null;
  const items = profile.development.recognitions ?? [];

  const onAdd = async () => {
    if (!title.trim()) return;
    await save({
      add_recognition: { title: title.trim(), description: description.trim() || null, category },
    });
    setTitle("");
    setDescription("");
    await reload();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-ds-border/60 p-4">
        <p className="text-sm font-bold text-ds-foreground">Add Recognition</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={dsLabelClass}>Title</label>
            <input className={dsInputStackedClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={dsLabelClass}>Category</label>
            <select className={cn(dsSelectClass, "mt-1.5")} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={dsLabelClass}>Description</label>
            <textarea
              className={cn(dsInputStackedClass, "resize-y")}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" className="mt-3 h-8 text-xs" disabled={saving || !title.trim()} onClick={() => void onAdd()}>
          Add Recognition
        </Button>
      </div>

      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className="text-sm text-ds-muted">No recognition recorded yet.</li>
        ) : (
          items.map((r) => (
            <li key={r.id} className="ops-dash-inner-card px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-ds-foreground">{r.title}</p>
                <time className="text-xs text-ds-muted">{formatShortDate(r.at)}</time>
              </div>
              <p className="mt-1 text-xs capitalize text-ds-muted">{r.category.replace(/_/g, " ")}</p>
              {r.description ? <p className="mt-2 text-sm text-ds-muted">{r.description}</p> : null}
              {r.awarded_by ? <p className="mt-1 text-[11px] text-ds-muted">Awarded by {r.awarded_by}</p> : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
