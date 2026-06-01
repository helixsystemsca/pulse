"use client";

import type { InventoryCategoryConfig, InventoryRegisterFormConfig } from "@/lib/inventory/register-form-config";
import {
  categoryValueForSave,
  enabledRegisterFields,
} from "@/lib/inventory/register-form-config";
import { getDepartmentBySlug, PLATFORM_DEPARTMENTS } from "@/config/platform/departments";
import { cn } from "@/lib/cn";

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

export type InventoryRegisterFormState = {
  name: string;
  sku: string;
  item_type: string;
  category_group: string;
  category: string;
  quantity: string;
  unit: string;
  low_stock_threshold: string;
  zone_id: string;
  assigned_user_id: string;
  linked_tool_id: string;
  department_slug: string;
  condition: string;
  unit_cost: string;
  vendor: string;
  reorder_flag: boolean;
};

type ZoneOpt = { id: string; name: string };
type AssetOpt = { id: string; name: string; tag_id?: string | null };
type WorkerOpt = { id: string; email: string; full_name: string | null };

type Props = {
  registerForm: InventoryRegisterFormConfig;
  categories: InventoryCategoryConfig[];
  form: InventoryRegisterFormState;
  onChange: (patch: Partial<InventoryRegisterFormState>) => void;
  zones: ZoneOpt[];
  assets: AssetOpt[];
  workers: WorkerOpt[];
  disabled?: boolean;
};

export function InventoryRegisterItemForm({
  registerForm,
  categories,
  form,
  onChange,
  zones,
  assets,
  workers,
  disabled,
}: Props) {
  const fields = enabledRegisterFields(registerForm);
  const selectedCategory = categories.find((c) => c.id === form.category_group);

  function setForm(patch: Partial<InventoryRegisterFormState>) {
    onChange(patch);
  }

  function renderField(fieldId: (typeof fields)[number]["id"]) {
    switch (fieldId) {
      case "name":
        return (
          <input
            className={FIELD}
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
            placeholder={fields.find((f) => f.id === "name")?.placeholder}
          />
        );
      case "sku":
        return (
          <input
            className={FIELD}
            value={form.sku}
            onChange={(e) => setForm({ sku: e.target.value })}
          />
        );
      case "item_type": {
        const cfg = fields.find((f) => f.id === "item_type");
        const options = cfg?.options ?? [
          { value: "tool", label: "Tool" },
          { value: "part", label: "Part" },
          { value: "consumable", label: "Consumable" },
        ];
        return (
          <select
            className={FIELD}
            value={form.item_type}
            onChange={(e) => setForm({ item_type: e.target.value })}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      case "category":
        return (
          <div className="space-y-3">
            <select
              className={FIELD}
              value={form.category_group}
              onChange={(e) => setForm({ category_group: e.target.value, category: "" })}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {selectedCategory && selectedCategory.options.length > 0 ? (
              <div>
                <label className={LABEL}>{selectedCategory.name} type</label>
                <select
                  className={FIELD}
                  value={form.category}
                  onChange={(e) => setForm({ category: e.target.value })}
                >
                  <option value="">—</option>
                  {selectedCategory.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        );
      case "quantity":
        return (
          <input
            className={FIELD}
            inputMode="decimal"
            disabled={form.item_type === "tool"}
            value={form.item_type === "tool" ? "1" : form.quantity}
            onChange={(e) => setForm({ quantity: e.target.value })}
          />
        );
      case "unit":
        return (
          <input className={FIELD} value={form.unit} onChange={(e) => setForm({ unit: e.target.value })} />
        );
      case "low_stock_threshold":
        return (
          <input
            className={FIELD}
            inputMode="decimal"
            value={form.low_stock_threshold}
            onChange={(e) => setForm({ low_stock_threshold: e.target.value })}
          />
        );
      case "department_slug":
        return (
          <select
            className={FIELD}
            value={form.department_slug}
            onChange={(e) => setForm({ department_slug: e.target.value })}
          >
            {PLATFORM_DEPARTMENTS.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        );
      case "condition": {
        const cfg = fields.find((f) => f.id === "condition");
        const options = cfg?.options ?? [
          { value: "good", label: "Good" },
          { value: "needs_maintenance", label: "Needs maintenance" },
          { value: "critical", label: "Critical / out of service" },
        ];
        return (
          <select
            className={FIELD}
            value={form.condition}
            onChange={(e) => setForm({ condition: e.target.value })}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      case "zone_id":
        return (
          <select className={FIELD} value={form.zone_id} onChange={(e) => setForm({ zone_id: e.target.value })}>
            <option value="">—</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        );
      case "assigned_user_id":
        return (
          <select
            className={FIELD}
            value={form.assigned_user_id}
            onChange={(e) => setForm({ assigned_user_id: e.target.value })}
          >
            <option value="">—</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.full_name || w.email}
              </option>
            ))}
          </select>
        );
      case "linked_tool_id":
        return (
          <select
            className={FIELD}
            value={form.linked_tool_id}
            onChange={(e) => setForm({ linked_tool_id: e.target.value })}
          >
            <option value="">—</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.tag_id ? ` (${a.tag_id})` : ""}
              </option>
            ))}
          </select>
        );
      case "vendor":
        return (
          <input
            className={FIELD}
            value={form.vendor}
            onChange={(e) => setForm({ vendor: e.target.value })}
            placeholder={fields.find((f) => f.id === "vendor")?.placeholder}
          />
        );
      case "unit_cost":
        return (
          <input
            className={FIELD}
            inputMode="decimal"
            value={form.unit_cost}
            onChange={(e) => setForm({ unit_cost: e.target.value })}
          />
        );
      case "reorder_flag":
        return (
          <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm font-semibold text-pulse-navy">
            <input
              type="checkbox"
              checked={form.reorder_flag}
              onChange={(e) => setForm({ reorder_flag: e.target.checked })}
            />
            {fields.find((f) => f.id === "reorder_flag")?.label ?? "Flag for reorder"}
          </label>
        );
      default:
        return null;
    }
  }

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", disabled && "pointer-events-none opacity-50")}>
      {fields.map((field) => {
        if (field.id === "reorder_flag") {
          return (
            <div key={field.id} className="flex items-end sm:col-span-1">
              {renderField(field.id)}
            </div>
          );
        }
        return (
          <div key={field.id} className={field.col_span === 2 ? "sm:col-span-2" : undefined}>
            <label className={LABEL}>{field.label}</label>
            {renderField(field.id)}
            {field.help_text ? <p className="mt-1 text-[11px] text-pulse-muted">{field.help_text}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export function registerFormStateToPayload(
  form: InventoryRegisterFormState,
  categories: InventoryCategoryConfig[],
) {
  const unit_cost = form.unit_cost.trim() === "" ? null : Number.parseFloat(form.unit_cost);
  return {
    name: form.name.trim(),
    sku: form.sku.trim() || null,
    item_type: form.item_type,
    category: categoryValueForSave(categories, form.category_group, form.category),
    quantity: Number.parseFloat(form.quantity) || 0,
    unit: form.unit.trim() || "count",
    low_stock_threshold: Number.parseFloat(form.low_stock_threshold) || 0,
    zone_id: form.zone_id || null,
    assigned_user_id: form.assigned_user_id || null,
    linked_tool_id: form.linked_tool_id || null,
    condition: form.condition,
    department_slug: form.department_slug,
    unit_cost: unit_cost != null && !Number.isNaN(unit_cost) ? unit_cost : null,
    vendor: form.vendor.trim() || null,
    reorder_flag: form.reorder_flag,
  };
}

export function departmentLabel(slug: string): string {
  return getDepartmentBySlug(slug)?.name ?? slug;
}
