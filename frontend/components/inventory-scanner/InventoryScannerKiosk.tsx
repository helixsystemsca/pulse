"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Minus, Plus, Search, TrendingUp } from "lucide-react";

import { useBarcodeScannerInput } from "@/lib/inventory-scanner/useBarcodeScannerInput";
import {
  fetchPopularInventoryProducts,
  lookupInventoryBySku,
  postInventoryScanTransaction,
  resolveInventoryProduct,
  searchInventoryProducts,
  type InventoryScanProduct,
} from "@/lib/inventory-scanner/inventoryScannerService";
import {
  readScannerRecentItems,
  rememberScannerRecentItem,
  type ScannerRecentItem,
} from "@/lib/inventory-scanner/scanner-recent";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cn } from "@/lib/cn";

type ScanAction = "receive" | "issue";

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function QuickPickButton({
  item,
  meta,
  onSelect,
}: {
  item: ScannerRecentItem | InventoryScanProduct;
  meta?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-sky-400/40 hover:bg-white/[0.07]"
    >
      <span className="truncate text-base font-medium text-white">{item.name}</span>
      <span className="truncate text-sm text-white/50">
        {item.sku}
        {meta ? ` · ${meta}` : ""}
      </span>
    </button>
  );
}

export function InventoryScannerKiosk() {
  const [product, setProduct] = useState<InventoryScanProduct | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suggestions, setSuggestions] = useState<InventoryScanProduct[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [recent, setRecent] = useState<ScannerRecentItem[]>([]);
  const [popular, setPopular] = useState<InventoryScanProduct[]>([]);
  const [action, setAction] = useState<ScanAction>("receive");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(readScannerRecentItems());
    void fetchPopularInventoryProducts(6)
      .then(setPopular)
      .catch(() => setPopular([]));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch) {
      setSuggestions([]);
      return;
    }
    let cancel = false;
    void searchInventoryProducts(debouncedSearch, 8)
      .then((rows) => {
        if (!cancel) setSuggestions(rows);
      })
      .catch(() => {
        if (!cancel) setSuggestions([]);
      });
    return () => {
      cancel = true;
    };
  }, [debouncedSearch]);

  const selectProduct = useCallback(async (input: { sku?: string; row?: InventoryScanProduct }) => {
    setBusy(true);
    setLookupErr(null);
    setSubmitErr(null);
    setSuggestOpen(false);
    try {
      const item = await resolveInventoryProduct(input);
      setProduct(item);
      setAction("receive");
      setQuantity(1);
      setSearch("");
      setDebouncedSearch("");
      setSuggestions([]);
      setRecent(rememberScannerRecentItem({ id: item.id, sku: item.sku, name: item.name }));
    } catch (e) {
      const { message } = parseClientApiError(e);
      setLookupErr(message || "Product not found");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleScan = useCallback(
    (raw: string) => {
      const sku = raw.trim();
      if (!sku || busy) return;
      void selectProduct({ sku });
    },
    [busy, selectProduct],
  );

  const { inputRef: scannerInputRef, handleKeyDown, handleChange } = useBarcodeScannerInput({
    enabled: true,
    onScan: handleScan,
  });

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 3200);
    return () => window.clearTimeout(id);
  }, [flash]);

  const clearProduct = useCallback(() => {
    setProduct(null);
    setAction("receive");
    setQuantity(1);
    setSubmitErr(null);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, []);

  const adjustQty = (delta: number) => {
    setQuantity((q) => Math.max(1, Math.round((q + delta) * 1000) / 1000));
  };

  const submitSearch = () => {
    const q = search.trim();
    if (!q) return;
    if (suggestions.length === 1) {
      void selectProduct({ row: suggestions[0] });
      return;
    }
    void selectProduct({ sku: q });
  };

  const submit = async () => {
    if (!product || busy) return;
    setBusy(true);
    setSubmitErr(null);
    try {
      const result = await postInventoryScanTransaction({
        sku: product.sku,
        action,
        quantity,
      });
      setProduct(result.item);
      setRecent(
        rememberScannerRecentItem({
          id: result.item.id,
          sku: result.item.sku,
          name: result.item.name,
        }),
      );
      setPopular((prev) => {
        const others = prev.filter((p) => p.id !== result.item.id);
        return [result.item, ...others].slice(0, 6);
      });
      setFlash(
        `${action === "receive" ? "Received" : "Issued"} ${quantity} ${result.item.unit} · On hand ${result.quantity_after}`,
      );
      window.setTimeout(clearProduct, 1100);
    } catch (e) {
      const { message } = parseClientApiError(e);
      setSubmitErr(message || "Could not complete transaction");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#0a0f14] text-white">
      <input
        ref={scannerInputRef}
        type="text"
        inputMode="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-hidden
        tabIndex={-1}
        data-scanner-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
        onKeyDown={handleKeyDown}
        onChange={handleChange}
      />

      <header className="shrink-0 border-b border-white/10 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Image
            src="/images/panoramalogo2.png"
            alt="Panorama"
            width={120}
            height={48}
            priority
            className="h-10 w-auto object-contain"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Inventory</h1>
            <p className="text-sm text-white/55">Search or scan to receive / issue stock</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-6 sm:px-8">
        {flash ? (
          <p className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
            {flash}
          </p>
        ) : null}
        {lookupErr ? (
          <p className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {lookupErr}
          </p>
        ) : null}

        {!product ? (
          <section className="space-y-3">
            <label className="block text-sm font-medium text-white/70" htmlFor="scanner-search">
              Find product
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              <input
                ref={searchRef}
                id="scanner-search"
                type="search"
                value={search}
                data-scanner-manual-input="true"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Name, SKU, or category…"
                disabled={busy}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSuggestOpen(true);
                  setLookupErr(null);
                }}
                onFocus={() => setSuggestOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSearch();
                  }
                  if (e.key === "Escape") {
                    setSuggestOpen(false);
                  }
                }}
                className="h-14 w-full rounded-2xl border border-white/15 bg-white/[0.06] pl-12 pr-4 text-lg text-white outline-none placeholder:text-white/35 focus:border-sky-400/60"
              />
              {suggestOpen && debouncedSearch && suggestions.length > 0 ? (
                <ul
                  className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#121820] py-2 shadow-2xl"
                  role="listbox"
                >
                  {suggestions.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        role="option"
                        className="flex w-full flex-col px-4 py-3 text-left hover:bg-white/[0.06]"
                        onClick={() => void selectProduct({ row })}
                      >
                        <span className="font-medium">{row.name}</span>
                        <span className="text-sm text-white/50">
                          {row.sku}
                          {row.category ? ` · ${row.category}` : ""} · {row.quantity} {row.unit}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {suggestOpen && debouncedSearch && !busy && suggestions.length === 0 ? (
                <p className="absolute z-20 mt-2 w-full rounded-2xl border border-white/10 bg-[#121820] px-4 py-3 text-sm text-white/55">
                  No matches — press Enter to try exact SKU
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {product ? (
          <section className="space-y-5 rounded-2xl border border-white/10 bg-[#121820] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-xs uppercase tracking-wide text-white/50">{product.sku}</p>
                <h2 className="text-2xl font-semibold leading-tight">{product.name}</h2>
                <p className="text-sm text-white/65">
                  {[product.category, product.item_type, statusLabel(product.inv_status)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {product.location_name ? (
                  <p className="text-sm text-white/55">Location: {product.location_name}</p>
                ) : null}
                <p className="pt-1 text-xl font-medium">
                  On hand: {product.quantity} {product.unit}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={clearProduct}
                className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75 hover:bg-white/5"
              >
                Change
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(["receive", "issue"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={busy}
                  onClick={() => setAction(kind)}
                  className={cn(
                    "rounded-xl border px-4 py-4 text-lg font-semibold capitalize transition",
                    action === kind
                      ? "border-sky-400 bg-sky-500/20 text-white"
                      : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10",
                  )}
                >
                  {kind}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={busy}
                onClick={() => adjustQty(-1)}
                className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                <Minus className="h-8 w-8" />
              </button>
              <input
                type="number"
                min={1}
                step={1}
                inputMode="decimal"
                value={quantity}
                disabled={busy}
                data-scanner-manual-input="true"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setQuantity(Number.isFinite(n) && n > 0 ? n : 1);
                }}
                className="h-16 w-28 rounded-xl border border-white/20 bg-black/30 text-center text-2xl font-semibold text-white outline-none focus:border-sky-400"
              />
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={busy}
                onClick={() => adjustQty(1)}
                className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                <Plus className="h-8 w-8" />
              </button>
            </div>

            {submitErr ? (
              <p className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-100">
                {submitErr}
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="w-full rounded-xl bg-sky-500 py-4 text-lg font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Complete transaction"}
            </button>
          </section>
        ) : (
          <>
            {recent.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-white/60">
                  <Clock className="h-4 w-4" />
                  Recent
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {recent.map((item) => (
                    <QuickPickButton
                      key={item.id}
                      item={item}
                      onSelect={() => void selectProduct({ sku: item.sku })}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {popular.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-white/60">
                  <TrendingUp className="h-4 w-4" />
                  Popular
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {popular.map((item) => (
                    <QuickPickButton
                      key={item.id}
                      item={item}
                      meta={`${item.quantity} ${item.unit}`}
                      onSelect={() => void selectProduct({ row: item })}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
