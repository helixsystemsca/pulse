"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import { useAsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import type { PurchasingModuleConfig } from "@/lib/purchasing/purchasing-module-config";
import {
  createQuickPurchase,
  uploadPurchaseReceipt,
  type QuickPurchaseLineInput,
  type VendorWithPerformance,
} from "@/lib/purchasing/purchasingService";
import { fetchPulseZonesCached } from "@/lib/pulse/pulse-reference-data";

const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100";

type LineDraft = QuickPurchaseLineInput & { key: string };

type Props = {
  apiCompany: string | null;
  config: PurchasingModuleConfig;
  vendors: VendorWithPerformance[];
  onSaved: () => void;
};

export function QuickPurchaseForm({ apiCompany, config, vendors, onSaved }: Props) {
  const { phase: submitPhase, run: runSubmit } = useAsyncSubmitPhase();
  const submitPending = submitPhase === "loading" || submitPhase === "success";
  const [err, setErr] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendorId, setVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [addToInventory, setAddToInventory] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [lines, setLines] = useState<LineDraft[]>([
    { key: "1", name: "", quantity: 1, unit_cost: null, category: "", add_to_inventory: false, zone_id: null },
  ]);

  useEffect(() => {
    void fetchPulseZonesCached()
      .then((z) => setZones(z.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => setZones([]));
  }, []);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        key: String(Date.now()),
        name: "",
        quantity: 1,
        unit_cost: null,
        category: "",
        add_to_inventory: addToInventory,
        zone_id: null,
      },
    ]);
  };

  const submit = async () => {
    setErr(null);
    const amount = Number.parseFloat(totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Enter a valid total amount.");
      return;
    }
    if (config.require_vendor_selection && !vendorId && !vendorName.trim()) {
      setErr("Select or enter a vendor.");
      return;
    }
    const cleanLines = lines.filter((l) => l.name.trim());
    if (!cleanLines.length) {
      setErr("Add at least one purchased item.");
      return;
    }
    if (config.require_receipt_upload && config.enable_receipt_uploads && !receiptFile) {
      setErr("A receipt upload is required for this organization.");
      return;
    }
    try {
      await runSubmit(async () => {
        const created = await createQuickPurchase(apiCompany, {
          purchase_date: purchaseDate,
          vendor_id: vendorId || null,
          vendor_name: vendorName.trim() || null,
          total_amount: amount,
          notes: notes.trim() || null,
          add_to_inventory: addToInventory,
          lines: cleanLines.map((l) => ({
            name: l.name.trim(),
            quantity: l.quantity,
            unit_cost: l.unit_cost ?? undefined,
            category: l.category?.trim() || undefined,
            add_to_inventory: addToInventory || Boolean(l.add_to_inventory),
            zone_id: l.zone_id || undefined,
          })),
        });
        if (receiptFile && config.enable_receipt_uploads) {
          await uploadPurchaseReceipt(apiCompany, created.id, receiptFile);
        }
        onSaved();
        setVendorId("");
        setVendorName("");
        setTotalAmount("");
        setNotes("");
        setReceiptFile(null);
        setLines([{ key: "1", name: "", quantity: 1, unit_cost: null, category: "", add_to_inventory: false, zone_id: null }]);
      });
    } catch (e) {
      setErr(parseClientApiError(e).message);
    }
  };

  return (
    <div className="space-y-6 rounded-xl border border-pulse-border bg-white p-5 shadow-sm dark:border-ds-border dark:bg-ds-primary">
      <h2 className="text-lg font-bold text-pulse-navy dark:text-gray-100">Quick Purchase</h2>
      {err ? <p className="text-sm text-rose-600">{err}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold text-pulse-muted">Purchase date</span>
          <input type="date" className={FIELD} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-pulse-muted">Total amount</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className={FIELD}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
          />
        </label>
      </div>

      {config.enable_vendor_tracking ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-pulse-muted">Vendor</span>
            <select className={FIELD} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">— Select vendor —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-pulse-muted">Or vendor name</span>
            <input className={FIELD} value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Store name" />
          </label>
        </div>
      ) : (
        <label className="block text-sm">
          <span className="font-semibold text-pulse-muted">Vendor / store</span>
          <input className={FIELD} value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
        </label>
      )}

      {config.enable_receipt_uploads ? (
        <label className="block text-sm">
          <span className="font-semibold text-pulse-muted">Receipt {config.require_receipt_upload ? "(required)" : "(optional)"}</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className={cn(FIELD, "py-2")}
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          />
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={addToInventory} onChange={(e) => setAddToInventory(e.target.checked)} />
        Add purchased items to inventory?
      </label>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-pulse-navy dark:text-gray-100">Purchased items</h3>
          <button type="button" className="text-sm font-semibold text-[#2B4C7E] dark:text-ds-accent" onClick={addLine}>
            <Plus className="mr-1 inline h-4 w-4" />
            Add line
          </button>
        </div>
        {lines.map((line, idx) => (
          <div key={line.key} className="grid gap-2 rounded-lg border border-slate-200/80 p-3 dark:border-ds-border sm:grid-cols-6">
            <input
              className={cn(FIELD, "sm:col-span-2")}
              placeholder="Item name"
              value={line.name}
              onChange={(e) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, name: e.target.value } : l)))
              }
            />
            <input
              type="number"
              min={1}
              className={FIELD}
              placeholder="Qty"
              value={line.quantity}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((l, i) => (i === idx ? { ...l, quantity: Number(e.target.value) || 1 } : l)),
                )
              }
            />
            <input
              type="number"
              step="0.01"
              className={FIELD}
              placeholder="Unit cost"
              value={line.unit_cost ?? ""}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((l, i) =>
                    i === idx ? { ...l, unit_cost: e.target.value ? Number(e.target.value) : null } : l,
                  ),
                )
              }
            />
            <input
              className={FIELD}
              placeholder="Category"
              value={line.category ?? ""}
              onChange={(e) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, category: e.target.value } : l)))
              }
            />
            {addToInventory && zones.length > 0 ? (
              <select
                className={FIELD}
                value={line.zone_id ?? ""}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, zone_id: e.target.value || null } : l)),
                  )
                }
              >
                <option value="">Location</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className="text-pulse-muted hover:text-rose-600"
              aria-label="Remove line"
              onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>

      <label className="block text-sm">
        <span className="font-semibold text-pulse-muted">Notes</span>
        <textarea className={cn(FIELD, "min-h-[4rem]")} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <AsyncSubmitButton
        phase={submitPhase}
        idleLabel="Save purchase"
        loadingLabel="Saving"
        disabled={submitPending}
        onClick={() => void submit()}
        className={PRIMARY}
      />
    </div>
  );
}
