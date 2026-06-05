"use client";

import type { InventoryRegisterFieldConfig, InventoryRegisterFormConfig } from "@/lib/inventory/register-form-config";
import {
  effectiveInputType,
  enabledRegisterFields,
  isBuiltinFieldId,
} from "@/lib/inventory/register-form-config";
import type { TenantDepartmentRow } from "@/lib/tenantDepartmentsService";
import { departmentNameForSlug, tenantDepartmentOptions } from "@/lib/tenantDepartmentsService";
import { InventoryItemPhotoUpload } from "@/components/inventory/InventoryItemPhotoUpload";
import { InventoryRegisterLookupHints } from "@/components/inventory/InventoryRegisterLookupHints";
import {
  normalizeLocationLinesForSave,
  parseLocationStock,
  sumLocationStockQuantity,
  type LocationStockLine,
} from "@/lib/inventory/inventory-location-stock";
import { cn } from "@/lib/cn";

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

export type InventoryRegisterLocationLineState = {
  zone_id: string;
  quantity: string;
};

export type InventoryRegisterFormState = {
  name: string;
  sku: string;
  item_type: string;
  category: string;
  quantity: string;
  unit: string;
  low_stock_threshold: string;
  zone_id: string;
  /** Per-location stock when the location field is enabled. */
  location_lines: InventoryRegisterLocationLineState[];
  assigned_user_id: string;
  linked_tool_id: string;
  department_slug: string;
  condition: string;
  unit_cost: string;
  vendor: string;
  reorder_flag: boolean;
  custom_attributes: Record<string, string | boolean>;
};

type ZoneOpt = { id: string; name: string };
type AssetOpt = { id: string; name: string; tag_id?: string | null };
type WorkerOpt = { id: string; email: string; full_name: string | null };

type Props = {
  registerForm: InventoryRegisterFormConfig;
  form: InventoryRegisterFormState;
  onChange: (patch: Partial<InventoryRegisterFormState>) => void;
  zones: ZoneOpt[];
  assets: AssetOpt[];
  workers: WorkerOpt[];
  departments: TenantDepartmentRow[];
  disabled?: boolean;
  itemId?: string | null;
  imageUrl?: string | null;
  pendingPhotoPreview?: string | null;
  onPendingPhoto?: (file: File | null) => void;
  onPhotoUploaded?: (imageUrl: string) => void;
  uploadPhoto?: (file: File) => Promise<{ image_url: string }>;
  /** When set, name field shows existing inventory matches while typing. */
  inventoryCompanyId?: string | null;
};

function locationLinesFromStock(
  stock: LocationStockLine[],
  fallbackZoneId: string | null | undefined,
  fallbackQuantity: number,
): InventoryRegisterLocationLineState[] {
  if (stock.length) {
    return stock.map((l) => ({ zone_id: l.zone_id, quantity: String(l.quantity) }));
  }
  if (fallbackZoneId) {
    return [{ zone_id: fallbackZoneId, quantity: String(fallbackQuantity) }];
  }
  return [{ zone_id: "", quantity: "" }];
}

function lineQtyForSync(line: InventoryRegisterLocationLineState, itemType: string, formQuantity: string): number {
  if (itemType === "tool") return 1;
  const parsed = Number.parseFloat(line.quantity);
  if (parsed > 0) return parsed;
  return Number.parseFloat(formQuantity) || 0;
}

function syncLocationLinesToForm(
  lines: InventoryRegisterLocationLineState[],
  itemType: string,
  formQuantity: string,
): Pick<InventoryRegisterFormState, "location_lines" | "zone_id" | "quantity"> {
  const withZone = lines.filter((l) => l.zone_id.trim());
  const valid = withZone.filter((l) => lineQtyForSync(l, itemType, formQuantity) > 0);
  const total =
    itemType === "tool"
      ? "1"
      : String(
          sumLocationStockQuantity(
            valid.map((l) => ({
              zone_id: l.zone_id,
              quantity: lineQtyForSync(l, itemType, formQuantity),
            })),
          ),
        );
  return {
    location_lines: lines,
    zone_id: valid[0]?.zone_id ?? "",
    quantity: total,
  };
}

function InventoryLocationLinesEditor({
  lines,
  zones,
  disabled,
  itemType,
  formQuantity,
  onChange,
}: {
  lines: InventoryRegisterLocationLineState[];
  zones: ZoneOpt[];
  disabled?: boolean;
  itemType: string;
  formQuantity: string;
  onChange: (patch: Pick<InventoryRegisterFormState, "location_lines" | "zone_id" | "quantity">) => void;
}) {
  function updateLine(index: number, patch: Partial<InventoryRegisterLocationLineState>) {
    const next = lines.map((line, i) => (i === index ? { ...line, ...patch } : line));
    onChange(syncLocationLinesToForm(next, itemType, formQuantity));
  }

  function addLine() {
    onChange(syncLocationLinesToForm([...lines, { zone_id: "", quantity: "" }], itemType, formQuantity));
  }

  function removeLine(index: number) {
    const next = lines.filter((_, i) => i !== index);
    onChange(
      syncLocationLinesToForm(
        next.length ? next : [{ zone_id: "", quantity: "" }],
        itemType,
        formQuantity,
      ),
    );
  }

  const zoneOptions = zones.map((z) => ({ value: z.id, label: z.name }));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1" />
        <div className={`w-24 ${LABEL}`}>Quantity</div>
        {lines.length > 1 ? <div className="w-14" /> : null}
      </div>
      {lines.map((line, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1">
            {renderSelect(
              line.zone_id,
              (zone_id) => updateLine(index, { zone_id }),
              zoneOptions,
              zones.length ? "Select zone…" : "No zones — add in setup wizard",
            )}
          </div>
          <div className="w-24">
            <input
              className={FIELD}
              inputMode="decimal"
              disabled={itemType === "tool"}
              value={itemType === "tool" ? "1" : line.quantity}
              onChange={(e) => updateLine(index, { quantity: e.target.value })}
            />
          </div>
          {lines.length > 1 ? (
            <button
              type="button"
              className="mb-0.5 rounded-md px-2 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
              disabled={disabled}
              onClick={() => removeLine(index)}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className="text-xs font-semibold text-[#2B4C7E] hover:underline disabled:opacity-40"
        disabled={disabled || itemType === "tool"}
        onClick={addLine}
      >
        + Add another location
      </button>
      {lines.filter((l) => l.zone_id.trim()).length > 1 ? (
        <p className="text-[11px] text-pulse-muted">
          Total on hand: {sumLocationStockQuantity(
            lines
              .filter((l) => l.zone_id.trim())
              .map((l) => ({
                zone_id: l.zone_id,
                quantity: Number.parseFloat(l.quantity) || 0,
              })),
          )}{" "}
          (updates quantity above)
        </p>
      ) : null}
    </div>
  );
}

function renderSelect(
  value: string,
  onValue: (v: string) => void,
  options: { value: string; label: string }[],
  placeholder = "—",
) {
  return (
    <select className={FIELD} value={value} onChange={(e) => onValue(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function InventoryRegisterItemForm({
  registerForm,
  form,
  onChange,
  zones,
  assets,
  workers,
  departments,
  disabled,
  itemId,
  imageUrl,
  pendingPhotoPreview,
  onPendingPhoto,
  onPhotoUploaded,
  uploadPhoto,
  inventoryCompanyId,
}: Props) {
  const fields = enabledRegisterFields(registerForm);

  function setForm(patch: Partial<InventoryRegisterFormState>) {
    onChange(patch);
  }

  function setCustom(id: string, value: string | boolean) {
    setForm({ custom_attributes: { ...form.custom_attributes, [id]: value } });
  }

  function renderTextOrSelect(
    field: InventoryRegisterFieldConfig,
    value: string,
    onValue: (v: string) => void,
    fallbackOptions?: { value: string; label: string }[],
    selectPlaceholder = "—",
  ) {
    const inputType = effectiveInputType(field);
    if (inputType === "select") {
      const options = field.options?.length ? field.options : (fallbackOptions ?? []);
      return renderSelect(value, onValue, options, selectPlaceholder);
    }
    return (
      <input
        className={FIELD}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        placeholder={field.placeholder}
      />
    );
  }

  function renderCustomField(field: InventoryRegisterFieldConfig) {
    const inputType = effectiveInputType(field);
    const raw = form.custom_attributes[field.id];
    if (inputType === "checkbox") {
      return (
        <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm font-semibold text-pulse-navy">
          <input
            type="checkbox"
            checked={Boolean(raw)}
            onChange={(e) => setCustom(field.id, e.target.checked)}
          />
          {field.label}
        </label>
      );
    }
    if (inputType === "number") {
      return (
        <input
          className={FIELD}
          inputMode="decimal"
          value={typeof raw === "string" ? raw : raw != null ? String(raw) : ""}
          onChange={(e) => setCustom(field.id, e.target.value)}
          placeholder={field.placeholder}
        />
      );
    }
    if (inputType === "select") {
      return renderSelect(
        typeof raw === "string" ? raw : "",
        (v) => setCustom(field.id, v),
        field.options ?? [],
      );
    }
    return (
      <input
        className={FIELD}
        value={typeof raw === "string" ? raw : ""}
        onChange={(e) => setCustom(field.id, e.target.value)}
        placeholder={field.placeholder}
      />
    );
  }

  function renderField(field: InventoryRegisterFieldConfig) {
    if (field.is_custom || !isBuiltinFieldId(field.id)) {
      return renderCustomField(field);
    }

    switch (field.id) {
      case "photo":
        return (
          <InventoryItemPhotoUpload
            itemId={itemId}
            imageUrl={imageUrl}
            pendingPreviewUrl={pendingPhotoPreview}
            disabled={disabled}
            onPendingFile={onPendingPhoto}
            onUploadComplete={onPhotoUploaded}
            uploadFile={uploadPhoto}
          />
        );
      case "name":
        if (effectiveInputType(field) === "select") {
          return renderTextOrSelect(field, form.name, (name) => setForm({ name }));
        }
        return (
          <InventoryRegisterLookupHints
            label={field.label}
            value={form.name}
            onChange={(name) => setForm({ name })}
            placeholder={field.placeholder}
            disabled={disabled}
            companyId={inventoryCompanyId ?? null}
            excludeItemId={itemId}
          />
        );
      case "sku":
        return renderTextOrSelect(field, form.sku, (sku) => setForm({ sku }));
      case "item_type":
        return renderTextOrSelect(
          field,
          form.item_type,
          (item_type) => setForm({ item_type }),
          [
            { value: "tool", label: "Tool" },
            { value: "part", label: "Part" },
            { value: "consumable", label: "Consumable" },
          ],
          "Select…",
        );
      case "category":
        return renderTextOrSelect(field, form.category, (category) => setForm({ category }));
      case "quantity": {
        const multiLoc =
          form.location_lines.filter((l) => l.zone_id.trim() && (Number.parseFloat(l.quantity) || 0) > 0)
            .length > 1;
        return (
          <input
            className={FIELD}
            inputMode="decimal"
            disabled={form.item_type === "tool" || multiLoc}
            title={multiLoc ? "Total is calculated from locations below" : undefined}
            value={form.item_type === "tool" ? "1" : form.quantity}
            onChange={(e) => setForm({ quantity: e.target.value })}
          />
        );
      }
      case "unit":
        return renderTextOrSelect(field, form.unit, (unit) => setForm({ unit }));
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
        return renderSelect(
          form.department_slug,
          (department_slug) => setForm({ department_slug }),
          tenantDepartmentOptions(departments),
          departments.length ? "Select department…" : "No departments — add in settings",
        );
      case "condition":
        return renderTextOrSelect(field, form.condition, (condition) => setForm({ condition }), [
          { value: "good", label: "Good" },
          { value: "needs_maintenance", label: "Needs maintenance" },
          { value: "critical", label: "Critical / out of service" },
        ]);
      case "zone_id":
        return (
          <InventoryLocationLinesEditor
            lines={form.location_lines}
            zones={zones}
            disabled={disabled}
            itemType={form.item_type}
            formQuantity={form.quantity}
            onChange={(patch) => setForm(patch)}
          />
        );
      case "shelf":
        return renderTextOrSelect(
          field,
          String(form.custom_attributes.shelf ?? ""),
          (shelf) => setCustom("shelf", shelf),
        );
      case "assigned_user_id":
        return renderSelect(
          form.assigned_user_id,
          (assigned_user_id) => setForm({ assigned_user_id }),
          workers.map((w) => ({ value: w.id, label: w.full_name || w.email })),
        );
      case "linked_tool_id":
        return renderSelect(
          form.linked_tool_id,
          (linked_tool_id) => setForm({ linked_tool_id }),
          assets.map((a) => ({
            value: a.id,
            label: `${a.name}${a.tag_id ? ` (${a.tag_id})` : ""}`,
          })),
        );
      case "vendor":
        return renderTextOrSelect(field, form.vendor, (vendor) => setForm({ vendor }));
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
            {field.label}
          </label>
        );
      default:
        return null;
    }
  }

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", disabled && "pointer-events-none opacity-50")}>
      {fields.map((field) => {
        const inputType = effectiveInputType(field);
        const isCheckbox = inputType === "checkbox" || field.id === "reorder_flag";

        if (isCheckbox) {
          return (
            <div key={field.id} className="flex items-end sm:col-span-1">
              {renderField(field)}
            </div>
          );
        }
        if (field.id === "photo") {
          return (
            <div key={field.id} className="sm:col-span-2">
              <label className={LABEL}>{field.label}</label>
              {renderField(field)}
              {field.help_text ? <p className="mt-1 text-[11px] text-pulse-muted">{field.help_text}</p> : null}
            </div>
          );
        }
        const skipOuterLabel =
          field.id === "zone_id" ||
          (field.id === "name" && effectiveInputType(field) !== "select");

        return (
          <div
            key={field.id}
            className={field.id === "zone_id" || field.col_span === 2 ? "sm:col-span-2" : undefined}
          >
            {field.id === "zone_id" ? (
              <div>
                <p className={LABEL}>{field.label}</p>
                {renderField(field)}
              </div>
            ) : (
              <>
                {!skipOuterLabel ? <label className={LABEL}>{field.label}</label> : null}
                {renderField(field)}
              </>
            )}
            {field.help_text ? <p className="mt-1 text-[11px] text-pulse-muted">{field.help_text}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export function registerFormStateToPayload(
  form: InventoryRegisterFormState,
  registerForm: InventoryRegisterFormConfig,
) {
  const unit_cost = form.unit_cost.trim() === "" ? null : Number.parseFloat(form.unit_cost);
  const enabled = enabledRegisterFields(registerForm);
  const custom_attributes: Record<string, string | number | boolean | null> = {};

  for (const field of enabled) {
    if (field.id === "shelf") {
      const raw = form.custom_attributes.shelf;
      custom_attributes.shelf = String(raw ?? "").trim() || null;
      continue;
    }
    if (!field.is_custom && isBuiltinFieldId(field.id)) continue;
    const raw = form.custom_attributes[field.id];
    const inputType = effectiveInputType(field);
    if (inputType === "checkbox") {
      custom_attributes[field.id] = Boolean(raw);
    } else if (inputType === "number") {
      const n = Number.parseFloat(String(raw ?? ""));
      custom_attributes[field.id] = Number.isNaN(n) ? null : n;
    } else {
      custom_attributes[field.id] = String(raw ?? "").trim() || null;
    }
  }

  const formQuantity = Number.parseFloat(form.quantity) || 0;
  const location_lines = normalizeLocationLinesForSave(
    form.location_lines.map((l) => ({
      zone_id: l.zone_id.trim(),
      quantity: Number.parseFloat(l.quantity) || 0,
    })),
    form.item_type,
    formQuantity,
  );

  const quantity =
    location_lines.length > 0 ? sumLocationStockQuantity(location_lines) : formQuantity;

  return {
    name: form.name.trim(),
    sku: form.sku.trim() || null,
    item_type: form.item_type,
    category: form.category.trim() || null,
    quantity,
    unit: form.unit.trim() || "count",
    low_stock_threshold: Number.parseFloat(form.low_stock_threshold) || 0,
    zone_id: (location_lines[0]?.zone_id ?? form.zone_id) || null,
    location_lines: location_lines.length > 0 ? location_lines : undefined,
    assigned_user_id: form.assigned_user_id || null,
    linked_tool_id: form.linked_tool_id || null,
    condition: form.condition,
    department_slug: form.department_slug,
    unit_cost: unit_cost != null && !Number.isNaN(unit_cost) ? unit_cost : null,
    vendor: form.vendor.trim() || null,
    reorder_flag: form.reorder_flag,
    custom_attributes,
  };
}

export function departmentLabel(slug: string, departments: TenantDepartmentRow[] = []): string {
  return departmentNameForSlug(departments, slug);
}

export function registerFormStateFromRow(
  row: Pick<
    InventoryRowLike,
    | "quantity"
    | "zone_id"
    | "custom_attributes"
  >,
): Pick<InventoryRegisterFormState, "location_lines" | "zone_id" | "quantity"> {
  const stock = parseLocationStock(row.custom_attributes);
  const location_lines = locationLinesFromStock(stock, row.zone_id, row.quantity);
  const zone_id = location_lines.find((l) => l.zone_id)?.zone_id ?? "";
  return { location_lines, zone_id, quantity: String(row.quantity) };
}

type InventoryRowLike = {
  quantity: number;
  zone_id?: string | null;
  custom_attributes?: Record<string, string | number | boolean | null>;
};

export function emptyRegisterFormState(defaultMin = 5, departmentSlug = ""): InventoryRegisterFormState {
  return {
    name: "",
    sku: "",
    item_type: "part",
    category: "",
    quantity: "0",
    unit: "count",
    low_stock_threshold: String(defaultMin),
    zone_id: "",
    location_lines: [{ zone_id: "", quantity: "" }],
    assigned_user_id: "",
    linked_tool_id: "",
    department_slug: departmentSlug,
    condition: "good",
    unit_cost: "",
    vendor: "",
    reorder_flag: false,
    custom_attributes: {},
  };
}

/** Pre-select a storage zone when registering new items (first zone by default). */
export function registerFormStateWithDefaultZone(
  base: InventoryRegisterFormState,
  zones: ZoneOpt[],
  defaultQuantity = "0",
): InventoryRegisterFormState {
  const first = zones[0];
  if (!first) return base;
  return {
    ...base,
    zone_id: first.id,
    location_lines: [{ zone_id: first.id, quantity: defaultQuantity }],
  };
}

export function validateRegisterFormZoneAssignment(
  form: InventoryRegisterFormState,
  registerForm: InventoryRegisterFormConfig,
  zones: ZoneOpt[],
): string | null {
  const zoneFieldEnabled = enabledRegisterFields(registerForm).some((f) => f.id === "zone_id");
  if (!zoneFieldEnabled || zones.length === 0) return null;
  const payload = registerFormStateToPayload(form, registerForm);
  if (payload.zone_id || (payload.location_lines && payload.location_lines.length > 0)) return null;
  return "Select a storage zone for this item.";
}
