"use client";

import { useEffect, useState } from "react";
import type {
  InventoryFieldInputType,
  InventoryRegisterFieldConfig,
  InventoryRegisterFormConfig,
  InventorySelectOption,
} from "@/lib/inventory/register-form-config";
import {
  canToggleFieldInputType,
  DEFAULT_REGISTER_FORM_FIELDS,
  effectiveInputType,
  isBuiltinFieldId,
  newCustomFieldDraft,
  nextFieldOrder,
} from "@/lib/inventory/register-form-config";
import { canConfigureTableColumn, defaultShowInTable } from "@/lib/inventory/inventory-list-columns";

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

const OPTION_FIELD = `${FIELD} py-1.5 text-sm`;

/** Stable value stored on the item when a dropdown choice is selected. */
function optionValueFromLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || "option";
}

function normalizeDropdownOptions(rows: InventorySelectOption[]): InventorySelectOption[] {
  return rows
    .map((o) => {
      const label = o.label.trim();
      const value = o.value.trim() || optionValueFromLabel(label);
      return { label: label || value, value };
    })
    .filter((o) => o.label);
}

function seedOptionRows(
  options: InventorySelectOption[] | undefined,
  defaults: InventorySelectOption[] | undefined,
): InventorySelectOption[] {
  if (options !== undefined && options.length > 0) {
    return options.map((o) => ({ ...o }));
  }
  if (defaults?.length) {
    return defaults.map((o) => ({ ...o }));
  }
  return [{ label: "", value: "" }];
}

function InventoryDropdownOptionsEditor({
  fieldId,
  options,
  defaultOptions,
  onChange,
}: {
  fieldId: string;
  options: InventorySelectOption[] | undefined;
  defaultOptions?: InventorySelectOption[];
  onChange: (options: InventorySelectOption[]) => void;
}) {
  const [rows, setRows] = useState(() => seedOptionRows(options, defaultOptions));

  useEffect(() => {
    setRows(seedOptionRows(options, defaultOptions));
  }, [fieldId]);

  function commitRows(next: InventorySelectOption[]) {
    setRows(next);
    onChange(next);
  }

  function patchRow(index: number, patch: Partial<InventorySelectOption>) {
    const next = rows.map((row, i) => {
      if (i !== index) return row;
      const merged = { ...row, ...patch };
      const label = merged.label.trim();
      const prevAutoValue = optionValueFromLabel(row.label);
      const valueWasAuto = !row.value.trim() || row.value.trim() === prevAutoValue;
      if (patch.label !== undefined && valueWasAuto) {
        merged.value = optionValueFromLabel(label);
      }
      return merged;
    });
    commitRows(next);
  }

  function addRow() {
    commitRows([...rows, { label: "", value: "" }]);
  }

  function removeRow(index: number) {
    const next = rows.filter((_, i) => i !== index);
    commitRows(next.length ? next : [{ label: "", value: "" }]);
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 dark:border-ds-border dark:bg-ds-secondary/40">
      <p className="text-xs leading-relaxed text-pulse-muted">
        Each row is one choice in the dropdown. <span className="font-semibold text-pulse-navy dark:text-gray-200">Shown as</span>{" "}
        is what your team reads; <span className="font-semibold text-pulse-navy dark:text-gray-200">Saved value</span> is optional
        and only needed when it must differ (for example, show &quot;Good&quot; but save <code className="text-[11px]">good</code>).
      </p>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-pulse-muted">
                Shown as
              </label>
              <input
                className={OPTION_FIELD}
                value={row.label}
                placeholder="e.g. Tool"
                onChange={(e) => patchRow(index, { label: e.target.value })}
              />
            </div>
            <div className="min-w-[8rem] flex-1">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-pulse-muted">
                Saved value <span className="normal-case font-medium">(optional)</span>
              </label>
              <input
                className={OPTION_FIELD}
                value={row.value}
                placeholder={row.label.trim() ? optionValueFromLabel(row.label) : "auto"}
                onChange={(e) => patchRow(index, { value: e.target.value })}
                onBlur={() => {
                  if (!row.value.trim() && row.label.trim()) {
                    patchRow(index, { value: optionValueFromLabel(row.label) });
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="mb-0.5 rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold text-pulse-muted hover:bg-white hover:text-red-700 disabled:opacity-30 dark:border-ds-border dark:hover:bg-ds-elevated"
              disabled={rows.length <= 1 && !row.label.trim() && !row.value.trim()}
              aria-label={`Remove choice ${index + 1}`}
              onClick={() => removeRow(index)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="text-xs font-semibold text-[#2B4C7E] hover:underline dark:text-sky-300"
        onClick={addRow}
      >
        + Add choice
      </button>
    </div>
  );
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
        Choose which fields appear when registering items, which columns show in the inventory table, and customize labels
        and input types. Fields not in the table still appear when you open an item.
      </p>
      <ul className="space-y-3">
        {fields.map((field, idx) => {
          const defaultField = isBuiltinFieldId(field.id)
            ? DEFAULT_REGISTER_FORM_FIELDS.find((d) => d.id === field.id)
            : undefined;
          const inputType = effectiveInputType(field);
          const toggleable = canToggleFieldInputType(field);
          const showOptions = inputType === "select";
          const showRequired =
            field.is_custom || field.id === "name" || (field.id === "item_type" && !field.is_custom);
          const tableToggle = canConfigureTableColumn(field);
          const inTable = defaultShowInTable(field);

          return (
            <li key={field.id} className="rounded-xl border border-slate-200/90 bg-white/80 p-4 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex min-w-[8rem] shrink-0 flex-col gap-2 pt-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-pulse-navy">
                    <input
                      type="checkbox"
                      checked={field.enabled}
                      onChange={(e) => patchField(field.id, { enabled: e.target.checked })}
                    />
                    On form
                  </label>
                  {tableToggle ? (
                    <label
                      className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-pulse-navy"
                      title="Show as a column in the inventory list"
                    >
                      <input
                        type="checkbox"
                        checked={inTable}
                        onChange={(e) => patchField(field.id, { show_in_table: e.target.checked })}
                      />
                      In table
                    </label>
                  ) : field.enabled ? (
                    <p className="text-[11px] leading-snug text-pulse-muted">
                      {field.id === "photo" ? "Photo" : "Name & SKU"} appear in the item column.
                    </p>
                  ) : null}
                </div>
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
                            options:
                              next === "select"
                                ? field.options?.length
                                  ? field.options
                                  : (defaultField?.options?.map((o) => ({ ...o })) ?? [{ label: "", value: "" }])
                                : undefined,
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
                            options:
                              next === "select"
                                ? field.options?.length
                                  ? field.options
                                  : (defaultField?.options?.map((o) => ({ ...o })) ?? [{ label: "", value: "" }])
                                : undefined,
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
                      <p className={LABEL}>Dropdown choices</p>
                      <InventoryDropdownOptionsEditor
                        fieldId={field.id}
                        options={field.options}
                        defaultOptions={defaultField?.options}
                        onChange={(options) => patchField(field.id, { options })}
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

