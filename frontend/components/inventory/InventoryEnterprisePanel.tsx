"use client";

import { useCallback, useEffect, useState } from "react";
import {
  checkinInventoryItem,
  checkoutInventoryItem,
  fetchInventoryForecast,
  fetchInventoryLifecycle,
  fetchOpenCheckout,
  patchInventoryLifecycle,
  type InventoryForecast,
  type InventoryLifecycle,
} from "@/lib/inventoryEnterpriseService";

export function InventoryEnterprisePanel({
  itemId,
  apiCompany,
  canEdit,
}: {
  itemId: string;
  apiCompany: string | null;
  canEdit: boolean;
}) {
  const [lifecycle, setLifecycle] = useState<InventoryLifecycle | null>(null);
  const [forecast, setForecast] = useState<InventoryForecast | null>(null);
  const [openCheckout, setOpenCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setErr(null);
    try {
      const [lc, fc, co] = await Promise.all([
        fetchInventoryLifecycle(itemId, apiCompany),
        fetchInventoryForecast(itemId, apiCompany),
        fetchOpenCheckout(itemId, apiCompany),
      ]);
      setLifecycle(lc);
      setForecast(fc);
      setOpenCheckout(Boolean(co.open));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load enterprise data");
    }
  }, [apiCompany, itemId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCheckout() {
    if (!canEdit) return;
    setBusy(true);
    setErr(null);
    try {
      await checkoutInventoryItem(itemId, {}, apiCompany);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCheckin() {
    if (!canEdit) return;
    setBusy(true);
    setErr(null);
    try {
      await checkinInventoryItem(itemId, {}, apiCompany);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveAcquisition() {
    if (!canEdit || !lifecycle) return;
    setBusy(true);
    try {
      const updated = await patchInventoryLifecycle(
        itemId,
        {
          acquired_on: lifecycle.acquired_on,
          acquisition_cost: lifecycle.acquisition_cost,
          useful_life_months: lifecycle.useful_life_months,
          salvage_value: lifecycle.salvage_value,
          depreciation_method: lifecycle.depreciation_method || "straight_line",
        },
        apiCompany,
      );
      setLifecycle(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!lifecycle && !forecast && !err) {
    return <p className="text-sm text-ds-muted">Loading lifecycle & forecast…</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      {err ? <p className="text-ds-danger">{err}</p> : null}

      {forecast ? (
        <div className="rounded-lg border border-ds-border bg-ds-secondary/40 p-3">
          <p className="font-semibold text-ds-foreground">Stock forecast</p>
          <p className="mt-1 text-ds-muted">
            ~{forecast.consumption_per_day}/day · effective reorder at {forecast.effective_threshold}{" "}
            {forecast.days_until_stockout != null
              ? `· ~${forecast.days_until_stockout} days until stockout`
              : ""}
          </p>
        </div>
      ) : null}

      {lifecycle ? (
        <div className="rounded-lg border border-ds-border p-3">
          <p className="font-semibold text-ds-foreground">Asset lifecycle</p>
          <p className="mt-1 text-ds-muted">
            Book value: {lifecycle.book_value != null ? `$${lifecycle.book_value.toFixed(2)}` : "—"}
            {lifecycle.disposed_on ? ` · Retired ${lifecycle.disposed_on}` : ""}
          </p>
          {canEdit ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-ds-muted">Acquisition cost</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-ds-border bg-ds-background px-2 py-1"
                  value={lifecycle.acquisition_cost ?? ""}
                  onChange={(e) =>
                    setLifecycle({
                      ...lifecycle,
                      acquisition_cost: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="block">
                <span className="text-xs text-ds-muted">Useful life (months)</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-ds-border bg-ds-background px-2 py-1"
                  value={lifecycle.useful_life_months ?? ""}
                  onChange={(e) =>
                    setLifecycle({
                      ...lifecycle,
                      useful_life_months: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveAcquisition()}
                className="rounded bg-ds-primary px-3 py-1.5 text-xs font-semibold text-white sm:col-span-2"
              >
                Save lifecycle
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {openCheckout ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCheckin()}
              className="rounded border border-ds-border px-3 py-1.5 font-medium"
            >
              Check in
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCheckout()}
              className="rounded bg-ds-primary px-3 py-1.5 font-medium text-white"
            >
              Check out
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
