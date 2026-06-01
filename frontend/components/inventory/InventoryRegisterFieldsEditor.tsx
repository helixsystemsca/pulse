"use client";

import type {
  InventoryRegisterFieldConfig,
  InventoryRegisterFieldId,
  InventoryRegisterFormConfig,
} from "@/lib/inventory/register-form-config";
import { DEFAULT_REGISTER_FORM_FIELDS } from "@/lib/inventory/register-form-config";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

const FIELD_HINTS: Partial<Record<InventoryRegisterFieldId, string>> = {
  photo: "Saved when you save the item. On mobile, tap to open the camera.",
  category: "Uses categories configured in the previous step.",
  zone_id: "Populated from facility zones.",
  assigned_user_id: "Populated from your worker roster.",
  linked_tool_id: "Populated from tracked assets.",
  department_slug: "Populated from platform departments.",
};

type Props = {
  registerForm: InventoryRegisterFormConfig;
  onChange: (next: InventoryRegisterFormConfig) => void;
};

export function InventoryRegisterFieldsEditor({ registerForm, onChange }: Props) {
  const fields = [...registerForm.fields].sort((a, b) => a.order - b.order);

  function patchField(id: InventoryRegisterFieldId, patch: Partial<InventoryRegisterFieldConfig>) {
    onChange({
      ...registerForm,
      fields: registerForm.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  }

  function moveField(id: InventoryRegisterFieldId, dir: -1 | 1) {
    const sorted = [...fields];
    const idx = sorted.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swap];
    const next = registerForm.fields.map((f) => {
      if (f.id === a.id) return { ...f, order: b.order };
      if (f.id === b.id) return { ...f, order: a.order };
      return f;
    });
    onChange({ ...registerForm, fields: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={LABEL} htmlFor="inv-register-subtitle">
          Form subtitle
        </label>
        <input
          id="inv-register-subtitle"
          className={FIELD}
          value={registerForm.subtitle ?? ""}
          onChange={(e) => onChange({ ...registerForm, subtitle: e.target.value })}
        />
      </div>
      <p className="text-sm text-pulse-muted">
        Choose which fields appear in the register item modal and customize their labels.
      </p>
      <ul className="space-y-3">
        {fields.map((field, idx) => {
          const defaultField = DEFAULT_REGISTER_FORM_FIELDS.find((d) => d.id === field.id);
          const hasOptions = Boolean(defaultField?.options?.length);
          return (
            <li key={field.id} className="rounded-xl border border-slate-200/90 bg-white/80 p-4 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <label className="flex min-w-[8rem] cursor-pointer items-center gap-2 pt-1 text-sm font-semibold text-pulse-navy">
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    onChange={(e) => patchField(field.id, { enabled: e.target.checked })}
                  />
                  Show
                </label>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <label className={LABEL} htmlFor={`inv-field-label-${field.id}`}>
                      Label
                    </label>
                    <input
                      id={`inv-field-label-${field.id}`}
                      className={FIELD}
                      value={field.label}
                      onChange={(e) => patchField(field.id, { label: e.target.value })}
                    />
                  </div>
                  {field.id === "name" ? (
                    <label className="flex items-center gap-2 text-xs font-medium text-pulse-muted">
                      <input
                        type="checkbox"
                        checked={field.required !== false}
                        onChange={(e) => patchField(field.id, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  ) : null}
                  {hasOptions ? (
                    <div>
                      <label className={LABEL} htmlFor={`inv-field-opts-${field.id}`}>
                        Dropdown options (value | label per line)
                      </label>
                      <textarea
                        id={`inv-field-opts-${field.id}`}
                        className={`${FIELD} min-h-[72px] font-mono text-xs`}
                        value={(field.options ?? defaultField?.options ?? [])
                          .map((o) => `${o.value} | ${o.label}`)
                          .join("\n")}
                        onChange={(e) => {
                          const options = e.target.value
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line) => {
                              const [value, ...rest] = line.split("|");
                              const label = rest.join("|").trim();
                              const v = value.trim();
                              return { value: v, label: label || v };
                            });
                          patchField(field.id, { options });
                        }}
                      />
                    </div>
                  ) : null}
                  {FIELD_HINTS[field.id] ? (
                    <p className="text-[11px] text-pulse-muted">{FIELD_HINTS[field.id]}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold disabled:opacity-40"
                    disabled={idx === 0}
                    onClick={() => moveField(field.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold disabled:opacity-40"
                    disabled={idx === fields.length - 1}
                    onClick={() => moveField(field.id, 1)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
