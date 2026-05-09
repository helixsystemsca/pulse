"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";
import {
  createInventoryVendor,
  deleteInventoryVendor,
  fetchInventoryVendors,
  patchInventoryVendor,
  type InventoryVendorListFilters,
  type InventoryVendorRow,
} from "@/lib/inventoryVendorsService";
import { parseClientApiError } from "@/lib/parse-client-api-error";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
const SECONDARY_BTN = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "px-4 py-2.5 text-sm font-semibold",
);
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";
const FILTER_FIELD =
  "w-full min-w-[4.5rem] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-pulse-navy outline-none focus:border-[#2B4C7E]/40 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100";

const TEXT_COLUMNS: {
  field: keyof InventoryVendorRow;
  filterKey: keyof InventoryVendorListFilters;
  label: string;
}[] = [
  { field: "name", filterKey: "name_contains", label: "Name" },
  { field: "contact_name", filterKey: "contact_name_contains", label: "Contact" },
  { field: "contact_email", filterKey: "contact_email_contains", label: "Email" },
  { field: "contact_phone", filterKey: "contact_phone_contains", label: "Phone" },
  { field: "account_number", filterKey: "account_number_contains", label: "Account #" },
  { field: "payment_terms", filterKey: "payment_terms_contains", label: "Payment terms" },
  { field: "item_specialty", filterKey: "item_specialty_contains", label: "Item specialty" },
  { field: "notes", filterKey: "notes_contains", label: "Notes" },
  { field: "website", filterKey: "website_contains", label: "Website" },
  { field: "address_line1", filterKey: "address_line1_contains", label: "Address 1" },
  { field: "address_line2", filterKey: "address_line2_contains", label: "Address 2" },
  { field: "city", filterKey: "city_contains", label: "City" },
  { field: "region", filterKey: "region_contains", label: "Region" },
  { field: "postal_code", filterKey: "postal_code_contains", label: "Postal" },
  { field: "country", filterKey: "country_contains", label: "Country" },
];

function emptyTextFilters(): Record<string, string> {
  return Object.fromEntries(TEXT_COLUMNS.map((c) => [c.filterKey, ""]));
}

function draftToApplied(texts: Record<string, string>, activeSel: "" | "true" | "false"): InventoryVendorListFilters {
  const out: Record<string, string | boolean> = {};
  for (const c of TEXT_COLUMNS) {
    const v = (texts[String(c.filterKey)] ?? "").trim();
    if (v) out[String(c.filterKey)] = v;
  }
  if (activeSel === "true") out.active = true;
  else if (activeSel === "false") out.active = false;
  return out as InventoryVendorListFilters;
}

function truncateCell(val: string | null | undefined, max = 36): string {
  const s = (val ?? "").trim();
  if (!s) return "—";
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function websiteHref(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

type FormState = {
  name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  account_number: string;
  payment_terms: string;
  item_specialty: string;
  notes: string;
  website: string;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  is_active: boolean;
};

function rowToForm(r: InventoryVendorRow): FormState {
  return {
    name: r.name,
    contact_name: r.contact_name ?? "",
    contact_email: r.contact_email ?? "",
    contact_phone: r.contact_phone ?? "",
    account_number: r.account_number ?? "",
    payment_terms: r.payment_terms ?? "",
    item_specialty: r.item_specialty ?? "",
    notes: r.notes ?? "",
    website: r.website ?? "",
    address_line1: r.address_line1 ?? "",
    address_line2: r.address_line2 ?? "",
    city: r.city ?? "",
    region: r.region ?? "",
    postal_code: r.postal_code ?? "",
    country: r.country ?? "",
    is_active: r.is_active,
  };
}

function emptyForm(): FormState {
  return {
    name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    account_number: "",
    payment_terms: "",
    item_specialty: "",
    notes: "",
    website: "",
    address_line1: "",
    address_line2: "",
    city: "",
    region: "",
    postal_code: "",
    country: "",
    is_active: true,
  };
}

export function InventoryVendorsPanel({ apiCompany }: { apiCompany: string | null }) {
  const [rows, setRows] = useState<InventoryVendorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [textDraft, setTextDraft] = useState(emptyTextFilters);
  const [activeDraft, setActiveDraft] = useState<"" | "true" | "false">("");
  const [applied, setApplied] = useState<InventoryVendorListFilters>({});

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setApplied(draftToApplied(textDraft, activeDraft));
    }, 320);
    return () => window.clearTimeout(t);
  }, [textDraft, activeDraft]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchInventoryVendors(apiCompany, applied);
      setRows(list);
    } catch (e) {
      const { message } = parseClientApiError(e);
      setErr(message || "Could not load vendors.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiCompany, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  function clearFilters() {
    setTextDraft(emptyTextFilters());
    setActiveDraft("");
  }

  function openCreate() {
    setDrawerMode("create");
    setEditingId(null);
    setForm(emptyForm());
    setDrawerOpen(true);
  }

  function openEdit(r: InventoryVendorRow) {
    setDrawerMode("edit");
    setEditingId(r.id);
    setForm(rowToForm(r));
    setDrawerOpen(true);
  }

  async function submitForm() {
    if (!form.name.trim()) return;
    setSaveBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        account_number: form.account_number.trim() || null,
        payment_terms: form.payment_terms.trim() || null,
        item_specialty: form.item_specialty.trim() || null,
        notes: form.notes.trim() || null,
        website: form.website.trim() || null,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        city: form.city.trim() || null,
        region: form.region.trim() || null,
        postal_code: form.postal_code.trim() || null,
        country: form.country.trim() || null,
        is_active: form.is_active,
      };
      if (drawerMode === "create") {
        await createInventoryVendor(apiCompany, body);
      } else if (editingId) {
        await patchInventoryVendor(apiCompany, editingId, body);
      }
      setDrawerOpen(false);
      await load();
    } catch (e) {
      const { message } = parseClientApiError(e);
      setErr(message || "Could not save vendor.");
    } finally {
      setSaveBusy(false);
    }
  }

  async function onDelete() {
    if (!editingId) return;
    if (!window.confirm("Delete this vendor? Inventory items that reference the vendor name are unchanged.")) return;
    setSaveBusy(true);
    try {
      await deleteInventoryVendor(apiCompany, editingId);
      setDrawerOpen(false);
      await load();
    } catch (e) {
      const { message } = parseClientApiError(e);
      setErr(message || "Could not delete vendor.");
    } finally {
      setSaveBusy(false);
    }
  }

  const colCount = useMemo(() => TEXT_COLUMNS.length + 2, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-pulse-navy">Vendor directory</p>
          <p className="text-xs text-pulse-muted">
            Contact, account, and specialty fields — type in any column filter (debounced) to narrow results.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SECONDARY_BTN} onClick={() => clearFilters()}>
            Clear filters
          </button>
          <button type="button" className={PRIMARY_BTN} onClick={() => openCreate()}>
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" aria-hidden />
              Add vendor
            </span>
          </button>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-pulse-border bg-white px-4 py-3 text-sm font-medium text-rose-600 dark:border-ds-border dark:bg-ds-primary">
          {err}
        </div>
      ) : null}

      <div className="app-data-shell overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-pulse-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading vendors…
          </div>
        ) : (
          <table className="min-w-[2200px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="app-table-head-row border-pulse-border">
                {TEXT_COLUMNS.map((c) => (
                  <th key={c.field} className="whitespace-nowrap px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-pulse-muted">
                    {c.label}
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-pulse-muted">
                  Active
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-pulse-muted">
                  Actions
                </th>
              </tr>
              <tr className="border-b border-pulse-border bg-slate-50/80 dark:bg-white/5">
                {TEXT_COLUMNS.map((c) => (
                  <th key={`f-${String(c.filterKey)}`} className="px-2 py-2 align-top">
                    <input
                      className={FILTER_FIELD}
                      value={textDraft[String(c.filterKey)] ?? ""}
                      onChange={(e) =>
                        setTextDraft((prev) => ({ ...prev, [String(c.filterKey)]: e.target.value }))
                      }
                      aria-label={`Filter ${c.label}`}
                    />
                  </th>
                ))}
                <th className="px-2 py-2 align-top">
                  <select
                    className={FILTER_FIELD}
                    value={activeDraft}
                    onChange={(e) => setActiveDraft(e.target.value as "" | "true" | "false")}
                    aria-label="Filter active status"
                  >
                    <option value="">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10 text-center text-sm text-pulse-muted">
                    No vendors match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-ds-interactive-hover dark:border-ds-border dark:hover:bg-ds-interactive-hover"
                    onClick={() => openEdit(r)}
                  >
                    {TEXT_COLUMNS.map((c) => {
                      const raw = r[c.field];
                      const display =
                        c.field === "website"
                          ? truncateCell(raw as string | null, 28)
                          : truncateCell(raw as string | null);
                      const href = c.field === "website" ? websiteHref(raw as string | null) : null;
                      return (
                        <td key={String(c.field)} className="max-w-[11rem] px-3 py-2 align-top text-pulse-navy">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-[#2B4C7E] underline underline-offset-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {display}
                            </a>
                          ) : (
                            <span title={(raw ?? "").toString()}>{display}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          r.is_active
                            ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70 dark:bg-emerald-700 dark:text-white"
                            : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {r.is_active ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <button
                        type="button"
                        className="text-xs font-bold uppercase tracking-wide text-[#2B4C7E] hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(r);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <PulseDrawer
        open={drawerOpen}
        title={drawerMode === "create" ? "Add vendor" : "Edit vendor"}
        subtitle="Stored per organization. Use item specialty for categories they supply."
        wide
        placement="center"
        onClose={() => {
          setDrawerOpen(false);
          setEditingId(null);
        }}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div>
              {drawerMode === "edit" ? (
                <button
                  type="button"
                  className={cn(SECONDARY_BTN, "border-rose-200 text-rose-700 hover:bg-rose-50")}
                  disabled={saveBusy}
                  onClick={() => void onDelete()}
                >
                  <span className="inline-flex items-center gap-2">
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete
                  </span>
                </button>
              ) : (
                <span />
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" className={SECONDARY_BTN} onClick={() => setDrawerOpen(false)}>
                Cancel
              </button>
              <button type="button" className={PRIMARY_BTN} disabled={saveBusy || !form.name.trim()} onClick={() => void submitForm()}>
                {saveBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL}>Vendor name</label>
            <input className={FIELD} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>Contact name</label>
            <input className={FIELD} value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>Contact email</label>
            <input className={FIELD} value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>Contact phone</label>
            <input className={FIELD} value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>Account #</label>
            <input className={FIELD} value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>Payment terms</label>
            <input className={FIELD} value={form.payment_terms} onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Item specialty</label>
            <textarea
              className={FIELD}
              rows={3}
              value={form.item_specialty}
              onChange={(e) => setForm((f) => ({ ...f, item_specialty: e.target.value }))}
              placeholder="e.g. fasteners, HVAC motors, cleaning chemicals…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Internal notes</label>
            <textarea className={FIELD} rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Website</label>
            <input className={FIELD} value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://…" />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Address line 1</label>
            <input className={FIELD} value={form.address_line1} onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Address line 2</label>
            <input className={FIELD} value={form.address_line2} onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>City</label>
            <input className={FIELD} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>Region / state</label>
            <input className={FIELD} value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>Postal code</label>
            <input className={FIELD} value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL}>Country</label>
            <input className={FIELD} value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
          </div>
          <div className="flex items-end sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-pulse-navy">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active vendor
            </label>
          </div>
        </div>
      </PulseDrawer>
    </div>
  );
}
