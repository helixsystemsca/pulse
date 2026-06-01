"use client";

import type {
  InventoryFieldInputType,
  InventoryRegisterFieldConfig,
  InventoryRegisterFormConfig,
} from "@/lib/inventory/register-form-config";
import {
  canToggleFieldInputType,
  DEFAULT_REGISTER_FORM_FIELDS,
  effectiveInputType,
  isBuiltinFieldId,
  newCustomFieldDraft,
  nextFieldOrder,
} from "@/lib/inventory/register-form-config";

const FIELD =
  "mt-1 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

const FIELD_HINTS: Partial<Record<string, string>> = {
  photo: "Shown on the item profile when you open an item from the inventory list.",
  zone_id: "Populated from facility zones.",
  assigned_user_id: "Populated from your worker roster.",
  linked_tool_id: "Populated from tracked assets.",
  department_slug: "Populated from platform departments.",
};

const FIXED_TYPE_LABELS: Partial<Record<InventoryFieldInputType, string>> = {
  photo: "Photo upload",
  number: "Number",
  checkbox: "Checkbox",
  zone_select: "Location picker",
  worker_select: "Worker picker",
  asset_select: "Asset picker",
  department_select: "Department picker",
  select: "Dropdown",
};

type Props = {
  registerForm: InventoryRegisterFormConfig;
  onChange: (next: InventoryRegisterFormConfig) => void;
};

function optionsToText(options: { value: string; label: string }[] | undefined): string {
  return (options ?? []).map((o) => `${o.value} | ${o.label}`).join("\n");
}

function parseOptions(text: string): { value: string; label: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, ...rest] = line.split("|");
      const label = rest.join("|").trim();
      const v = value.trim();
      return { value: v, label: label || v };
    });
}

export function InventoryRegisterFieldsEditor({ registerForm, onChange }: Props) {
  const fields = [...registerForm.fields].sort((a, b) => a.order - b.order);

  function patchField(id: string, patch: Partial<InventoryRegisterFieldConfig>) {
    onChange({
      ...registerForm,
      fields: registerForm.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  }

  function removeField(id: string) {
    onChange({
      ...registerForm,
      fields: registerForm.fields.filter((f) => f.id !== id),
    });
  }

  function moveField(id: string, dir: -1 | 1) {
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

  function addField() {
    const draft = newCustomFieldDraft("Custom field");
    draft.order = nextFieldOrder(registerForm.fields);
    onChange({ ...registerForm, fields: [...registerForm.fields, draft] });
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
        Choose which fields appear in the register item modal, add custom fields, and customize labels and input types.
      </p>
      <ul className="space-y-3">
        {fields.map((field, idx) => {
          const defaultField = isBuiltinFieldId(field.id)
            ? DEFAULT_REGISTER_FORM_FIELDS.find((d) => d.id === field.id)
            : undefined;
          const inputType = effectiveInputType(field);
          const toggleable = canToggleFieldInputType(field);
          const showOptions =
            inputType === "select" ||
            (isBuiltinFieldId(field.id) && (field.id === "item_type" || field.id === "condition"));
          const showRequired =
            field.is_custom || field.id === "name" || (field.id === "item_type" && !field.is_custom);

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
                  {field.is_custom ? (
                    <div>
                      <label className={LABEL} htmlFor={`inv-field-custom-type-${field.id}`}>
                        Field type
                      </label>
                      <select
                        id={`inv-field-custom-type-${field.id}`}
                        className={FIELD}
                        value={inputType}
                        onChange={(e) => {
                          const next = e.target.value as InventoryFieldInputType;
                          patchField(field.id, {
                            input_type: next,
                            options: next === "select" ? field.options ?? [] : undefined,
                          });
                        }}
                      >
                        <option value="text">Text input</option>
                        <option value="select">Dropdown</option>
                        <option value="number">Number</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                    </div>
                  ) : toggleable ? (
                    <div>
                      <label className={LABEL} htmlFor={`inv-field-type-${field.id}`}>
                        Input type
                      </label>
                      <select
                        id={`inv-field-type-${field.id}`}
                        className={FIELD}
                        value={inputType === "select" ? "select" : "text"}
                        onChange={(e) => {
                          const next = e.target.value as "text" | "select";
                          patchField(field.id, {
                            input_type: next,
                            options: next === "select" ? field.options ?? [] : undefined,
                          });
                        }}
                      >
                        <option value="text">Text input</option>
                        <option value="select">Dropdown</option>
                      </select>
                    </div>
                  ) : (
                    <p className="text-[11px] text-pulse-muted">
                      Input: {FIXED_TYPE_LABELS[inputType] ?? inputType.replace(/_/g, " ")}
                    </p>
                  )}
                  {showRequired ? (
                    <label className="flex items-center gap-2 text-xs font-medium text-pulse-muted">
                      <input
                        type="checkbox"
                        checked={field.required !== false}
                        onChange={(e) => patchField(field.id, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  ) : null}
                  {showOptions ? (
                    <div>
                      <label className={LABEL} htmlFor={`inv-field-opts-${field.id}`}>
                        Dropdown options (value | label per line)
                      </label>
                      <textarea
                        id={`inv-field-opts-${field.id}`}
                        className={`${FIELD} min-h-[72px] font-mono text-xs`}
                        value={optionsToText(field.options ?? defaultField?.options)}
                        onChange={(e) => patchField(field.id, { options: parseOptions(e.target.value) })}
                      />
                    </div>
                  ) : null}
                  {field.id === "photo" ? (
                    <p className="text-[11px] text-pulse-muted">
                      Saved when you save the item. On mobile, tap to open the camera.
                    </p>
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
                  {field.is_custom ? (
                    <button
                      type="button"
                      className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                      onClick={() => removeField(field.id)}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-[#2B4C7E] hover:border-[#2B4C7E]/40 hover:bg-slate-50"
        onClick={addField}
      >
        + Add field
      </button>
    </div>
  );
}
