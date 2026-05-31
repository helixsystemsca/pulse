"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, LogOut, Minus, Plus, Search, TrendingUp } from "lucide-react";

import {
  useBarcodeScannerInput,
  type ScannerConnectionStatus,
} from "@/lib/inventory-scanner/useBarcodeScannerInput";
import {
  fetchPopularInventoryProducts,
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
import { performPulseLogout } from "@/lib/pulse-auth-lifecycle";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cn } from "@/lib/cn";
import { dsInputClass } from "@/components/ui/ds-form-classes";

type ScanAction = "receive" | "issue";

const SCANNER_LOBSTER = "#e85d6f";

const bubbleBase =
  "relative overflow-hidden border border-white/50 shadow-[0_8px_32px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45";

const bubbleIdle = cn(
  bubbleBase,
  "bg-gradient-to-br from-white/75 via-white/45 to-[color-mix(in_srgb,var(--ds-accent)_10%,transparent)]",
  "hover:from-white/85 hover:to-[color-mix(in_srgb,var(--ds-accent)_16%,transparent)]",
);

const bubbleActiveReceive = cn(
  bubbleBase,
  "border-[color-mix(in_srgb,var(--ds-success)_35%,white)]",
  "bg-gradient-to-br from-[color-mix(in_srgb,var(--ds-success)_28%,white)] via-[color-mix(in_srgb,var(--ds-success)_16%,white/60)] to-[color-mix(in_srgb,var(--ds-success)_8%,transparent)]",
  "shadow-[0_10px_40px_color-mix(in_srgb,var(--ds-success)_22%,transparent),inset_0_1px_0_rgba(255,255,255,0.7)]",
  "ring-2 ring-[color-mix(in_srgb,var(--ds-success)_25%,transparent)]",
);

const bubbleActiveIssue = cn(
  bubbleBase,
  "border-[color-mix(in_srgb,#e85d6f_35%,white)]",
  "bg-gradient-to-br from-[color-mix(in_srgb,#e85d6f_24%,white)] via-[color-mix(in_srgb,#e85d6f_14%,white/60)] to-[color-mix(in_srgb,#e85d6f_8%,transparent)]",
  "shadow-[0_10px_40px_color-mix(in_srgb,#e85d6f_20%,transparent),inset_0_1px_0_rgba(255,255,255,0.7)]",
  "ring-2 ring-[color-mix(in_srgb,#e85d6f_22%,transparent)]",
);

const bubbleCircle = cn(
  bubbleIdle,
  "flex shrink-0 items-center justify-center rounded-full !p-0",
);

const scannerSearchClass = cn(
  dsInputClass,
  "h-[4.5rem] w-full rounded-[2rem] border-white/50 bg-white/60 pl-14 pr-6 text-2xl text-ds-foreground shadow-[0_8px_32px_rgba(15,23,42,0.06)] backdrop-blur-md placeholder:text-ds-muted",
);

const dropdownClass =
  "rounded-[1.5rem] border border-white/50 bg-white/80 py-2 shadow-xl backdrop-blur-xl";

const quickPickClass = cn(
  bubbleIdle,
  "flex min-w-0 flex-col rounded-[1.25rem] px-5 py-4 text-left",
);

function ScannerConnectionBadge({ status }: { status: ScannerConnectionStatus }) {
  const connected = status === "connected";
  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-sm sm:bottom-5 sm:right-5",
        connected
          ? "border-[color-mix(in_srgb,var(--ds-success)_40%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-success)_14%,var(--ds-bg))] text-[var(--ds-success)]"
          : "border-[color-mix(in_srgb,#e85d6f_40%,var(--ds-border))] bg-[color-mix(in_srgb,#e85d6f_14%,var(--ds-bg))] text-[#e85d6f]",
      )}
      role="status"
      aria-live="polite"
      aria-label={connected ? "Scanner connected" : "Scanner disconnected"}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: connected ? "var(--ds-success)" : SCANNER_LOBSTER }}
        aria-hidden
      />
      Scanner: {connected ? "Connected" : "Disconnected"}
    </div>
  );
}

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
    <button type="button" onClick={onSelect} className={quickPickClass}>
      <span className="truncate text-lg font-semibold text-ds-foreground">{item.name}</span>
      <span className="truncate text-base text-ds-muted">
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
  const [logoutBusy, setLogoutBusy] = useState(false);
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

  const { inputRef: scannerInputRef, handleKeyDown, handleChange, connectionStatus } =
    useBarcodeScannerInput({
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

  const onLogout = () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    void performPulseLogout("user").finally(() => setLogoutBusy(false));
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-ds-bg text-ds-foreground">
      <ScannerConnectionBadge status={connectionStatus} />
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

      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ds-border/80 bg-ds-primary/90 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Image
            src="/images/panoramalogo2.png"
            alt="Panorama"
            width={140}
            height={56}
            priority
            className="h-11 w-auto shrink-0 object-contain sm:h-12"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-ds-foreground sm:text-3xl">Inventory</h1>
            <p className="hidden text-sm text-ds-muted sm:block">Search or scan to receive / issue stock</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={logoutBusy || busy}
          className={cn(
            bubbleIdle,
            "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold sm:px-5 sm:py-3 sm:text-base",
          )}
          title="Sign out (testing)"
        >
          <LogOut className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
          Log out
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex w-full max-w-4xl flex-col items-center gap-8 sm:max-w-5xl sm:gap-10">
          {flash ? (
            <p
              className="w-full rounded-2xl border px-5 py-4 text-center text-lg"
              style={{
                borderColor: "color-mix(in srgb, var(--ds-success) 40%, var(--ds-border))",
                background: "color-mix(in srgb, var(--ds-success) 12%, var(--ds-bg))",
                color: "var(--ds-text-primary)",
              }}
            >
              {flash}
            </p>
          ) : null}
          {lookupErr ? (
            <p
              className="w-full rounded-2xl border px-5 py-4 text-center text-lg"
              style={{
                borderColor: "color-mix(in srgb, var(--ds-danger) 40%, var(--ds-border))",
                background: "color-mix(in srgb, var(--ds-danger) 10%, var(--ds-bg))",
                color: "var(--ds-text-primary)",
              }}
            >
              {lookupErr}
            </p>
          ) : null}

          {!product ? (
            <section className="flex w-full flex-col items-center gap-6">
              <label
                className="text-center text-lg font-semibold uppercase tracking-widest text-ds-muted sm:text-xl"
                htmlFor="scanner-search"
              >
                Find product
              </label>
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-6 top-1/2 h-7 w-7 -translate-y-1/2 text-ds-muted" />
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
                  className={scannerSearchClass}
                />
                {suggestOpen && debouncedSearch && suggestions.length > 0 ? (
                  <ul
                    className={cn(dropdownClass, "absolute z-20 mt-3 max-h-80 w-full overflow-y-auto")}
                    role="listbox"
                  >
                    {suggestions.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          role="option"
                          className="flex w-full flex-col px-6 py-4 text-left hover:bg-white/50"
                          onClick={() => void selectProduct({ row })}
                        >
                          <span className="text-xl font-semibold text-ds-foreground">{row.name}</span>
                          <span className="text-base text-ds-muted">
                            {row.sku}
                            {row.category ? ` · ${row.category}` : ""} · {row.quantity} {row.unit}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {suggestOpen && debouncedSearch && !busy && suggestions.length === 0 ? (
                  <p className={cn(dropdownClass, "absolute z-20 mt-3 w-full px-6 py-4 text-center text-lg text-ds-muted")}>
                    No matches — press Enter to try exact SKU
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {product ? (
            <section className="flex w-full flex-col items-center gap-8 sm:gap-10">
              <div className="relative w-full text-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={clearProduct}
                  className={cn(
                    bubbleIdle,
                    "absolute right-0 top-0 rounded-full px-4 py-2 text-sm font-semibold sm:text-base",
                  )}
                >
                  Change
                </button>
                <p className="text-base font-medium uppercase tracking-widest text-ds-muted sm:text-lg">{product.sku}</p>
                <h2 className="mt-2 text-4xl font-bold leading-tight text-ds-foreground sm:text-5xl">{product.name}</h2>
                <p className="mt-3 text-lg text-ds-muted sm:text-xl">
                  {[product.category, product.item_type, statusLabel(product.inv_status)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {product.location_name ? (
                  <p className="mt-1 text-lg text-ds-muted">Location: {product.location_name}</p>
                ) : null}
                <p className="mt-5 text-3xl font-semibold text-ds-foreground sm:text-4xl">
                  On hand: {product.quantity} {product.unit}
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-4 sm:gap-5">
                {(["receive", "issue"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    disabled={busy}
                    onClick={() => setAction(kind)}
                    className={cn(
                      "rounded-[2rem] px-4 py-7 text-2xl font-bold capitalize sm:py-8 sm:text-3xl",
                      action === kind
                        ? kind === "receive"
                          ? bubbleActiveReceive
                          : bubbleActiveIssue
                        : bubbleIdle,
                    )}
                  >
                    {kind}
                  </button>
                ))}
              </div>

              <div className="flex w-full max-w-md items-center justify-center gap-5 sm:gap-6">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={busy}
                  onClick={() => adjustQty(-1)}
                  className={cn(bubbleCircle, "h-20 w-20 sm:h-24 sm:w-24")}
                >
                  <Minus className="h-9 w-9 sm:h-10 sm:w-10" />
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
                  className={cn(
                    scannerSearchClass,
                    "h-20 w-32 text-center text-4xl font-bold sm:h-24 sm:w-36 sm:text-5xl",
                  )}
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={busy}
                  onClick={() => adjustQty(1)}
                  className={cn(bubbleCircle, "h-20 w-20 sm:h-24 sm:w-24")}
                >
                  <Plus className="h-9 w-9 sm:h-10 sm:w-10" />
                </button>
              </div>

              {submitErr ? (
                <p
                  className="w-full rounded-2xl border px-5 py-4 text-center text-lg"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ds-danger) 40%, var(--ds-border))",
                    background: "color-mix(in srgb, var(--ds-danger) 8%, var(--ds-bg))",
                    color: "var(--ds-text-primary)",
                  }}
                >
                  {submitErr}
                </p>
              ) : null}

              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className={cn(
                  bubbleBase,
                  "w-full rounded-[2rem] border-[color-mix(in_srgb,var(--ds-accent)_40%,white)] bg-gradient-to-br from-[color-mix(in_srgb,var(--ds-accent)_55%,#ffffff)] via-[color-mix(in_srgb,var(--ds-accent)_35%,#ffffff)] to-[color-mix(in_srgb,var(--ds-accent)_20%,transparent)] py-6 text-2xl font-bold text-white shadow-[0_12px_40px_color-mix(in_srgb,var(--ds-accent)_35%,transparent),inset_0_1px_0_rgba(255,255,255,0.35)] sm:py-7 sm:text-3xl",
                )}
              >
                {busy ? "Saving…" : "Complete transaction"}
              </button>
            </section>
          ) : (
            <>
              {recent.length > 0 ? (
                <section className="w-full space-y-4">
                  <div className="flex items-center justify-center gap-2 text-lg font-semibold text-ds-muted">
                    <Clock className="h-5 w-5" />
                    Recent
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
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
                <section className="w-full space-y-4">
                  <div className="flex items-center justify-center gap-2 text-lg font-semibold text-ds-muted">
                    <TrendingUp className="h-5 w-5" />
                    Popular
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </main>
    </div>
  );
}
