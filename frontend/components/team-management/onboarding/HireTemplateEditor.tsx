"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { dsInputClass, dsLabelClass, dsSelectClass } from "@/components/ui/ds-form-classes";
import type { HireAppliesWhen, HireDocKind, HireTemplateItemWrite } from "@/lib/hireOnboardingService";
import { cn } from "@/lib/cn";

export function HireTemplateEditor({
  name,
  items,
  onNameChange,
  onItemsChange,
  saving,
  onSave,
}: {
  name: string;
  items: HireTemplateItemWrite[];
  onNameChange: (name: string) => void;
  onItemsChange: (items: HireTemplateItemWrite[]) => void;
  saving: boolean;
  onSave: () => void;
}) {
  function update(index: number, patch: Partial<HireTemplateItemWrite>) {
    onItemsChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    const copy = [...items];
    const [row] = copy.splice(index, 1);
    copy.splice(next, 0, row);
    onItemsChange(copy);
  }

  return (
    <div className="space-y-4">
      <label className="block max-w-md">
        <span className={dsLabelClass}>Template name</span>
        <input className={cn(dsInputClass, "mt-1.5")} value={name} onChange={(e) => onNameChange(e.target.value)} />
      </label>

      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={item.id || item.key || `new-${index}`} className="ops-dash-inner-card space-y-3 p-4">
            <div className="flex flex-wrap items-start gap-2">
              <input
                className={cn(dsInputClass, "min-w-[12rem] flex-1")}
                value={item.title}
                onChange={(e) => update(index, { title: e.target.value })}
                aria-label="Document title"
              />
              <select
                className={cn(dsSelectClass, "w-auto min-w-[7rem]")}
                value={item.kind}
                onChange={(e) => update(index, { kind: e.target.value as HireDocKind })}
                aria-label="Document type"
              >
                <option value="review">Review</option>
                <option value="sign">Sign</option>
              </select>
              <select
                className={cn(dsSelectClass, "w-auto min-w-[9rem]")}
                value={item.applies_when}
                onChange={(e) => update(index, { applies_when: e.target.value as HireAppliesWhen })}
                aria-label="When this document applies"
              >
                <option value="always">All hires</option>
                <option value="plant_role">Plant / ice roles</option>
              </select>
              <div className="ml-auto flex gap-1">
                <Button type="button" variant="secondary" className="h-8 w-8 px-0" onClick={() => move(index, -1)} aria-label="Move up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="secondary" className="h-8 w-8 px-0" onClick={() => move(index, 1)} aria-label="Move down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 w-8 px-0"
                  onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
                  aria-label="Remove document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <textarea
              className={cn(dsInputClass, "min-h-[4.5rem]")}
              value={item.body_text ?? ""}
              onChange={(e) => update(index, { body_text: e.target.value })}
              placeholder="Document text shown at review or sign-off"
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-8 px-3 text-xs"
          onClick={() =>
            onItemsChange([
              ...items,
              {
                title: "New required document",
                kind: "review",
                applies_when: "always",
                is_required: true,
                body_text: "",
              },
            ])
          }
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add document
        </Button>
        <Button type="button" className="h-8 px-3 text-xs" disabled={saving || items.length === 0} onClick={onSave}>
          Save template
        </Button>
      </div>
    </div>
  );
}
