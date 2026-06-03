"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Clock, LogOut, MapPin, Package, Trash2, TrendingUp } from "lucide-react";

import { Card } from "@/components/pulse/Card";
import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import { useAsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import { TenantBrandMark } from "@/components/branding/TenantBrandMark";
import { ScannerSearchStrip } from "@/components/inventory-scanner/ScannerSearchStrip";
import {
  TxBubbleButton,
  TxHomeTile,
  TxQtyStepper,
  txBubbleIssue,
  txBubblePrimary,
  txBubbleReceive,
  txFieldClass,
  txLabelClass,
} from "@/components/inventory-transactions/transaction-ui";
import {
  useBarcodeScannerInput,
  type ScannerConnectionStatus,
} from "@/lib/inventory-scanner/useBarcodeScannerInput";
import {
  fetchPopularInventoryProducts,
  resolveInventoryProduct,
  searchInventoryProducts,
  type InventoryScanProduct,
} from "@/lib/inventory-scanner/inventoryScannerService";
import {
  readScannerRecentItems,
  rememberScannerRecentItem,
  type ScannerRecentItem,
} from "@/lib/inventory-scanner/scanner-recent";
import {
  commitInventoryTransactionBatch,
  commitInventoryTransactionSingle,
  fetchInventoryTransactionSettings,
} from "@/lib/inventory/transactions/inventoryTransactionApi";
import type { InventoryTransactionSettings } from "@/lib/inventory/transactions/settings";
import type { TransactionCartLine, TransactionMode, TransactionReference } from "@/lib/inventory/transactions/types";
import { emptyReference, referenceFilled } from "@/lib/inventory/transactions/types";
import { fetchPulseZonesCached } from "@/lib/pulse/pulse-reference-data";
import { performPulseLogout } from "@/lib/pulse-auth-lifecycle";
import { pulseAppHref } from "@/lib/pulse-app";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cn } from "@/lib/cn";
import { useResolvedProtectedAssetSrc } from "@/lib/useResolvedProtectedAssetSrc";

export type InventoryTransactionsPresentation = "dedicated" | "staff";

type Screen = "home" | "search" | "quantity" | "batch" | "find";

type InventoryTransactionsAppProps = {
  presentation?: InventoryTransactionsPresentation;
};

function ScannerConnectionBadge({ status }: { status: ScannerConnectionStatus }) {
  const connected = status === "connected";
  const statusColor = connected ? "var(--ds-success)" : "#e85d6f";
  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm sm:bottom-5 sm:right-5",
        connected
          ? "border-[color-mix(in_srgb,var(--ds-success)_40%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-success)_14%,var(--ds-bg))]"
          : "border-[color-mix(in_srgb,#e85d6f_40%,var(--ds-border))] bg-[color-mix(in_srgb,#e85d6f_14%,var(--ds-bg))]",
      )}
      role="status"
      aria-live="polite"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusColor }} aria-hidden />
      <span className="text-black dark:text-ds-foreground">
        Scanner:{" "}
        <span style={{ color: statusColor }}>{connected ? "Connected" : "Disconnected"}</span>
      </span>
    </div>
  );
}

function ProductPhoto({ imageUrl, name, compact }: { imageUrl: string | null; name: string; compact?: boolean }) {
  const { src, loading } = useResolvedProtectedAssetSrc(imageUrl);
  return (
    <div
      className={cn(
        "relative flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-ds-border bg-[color-mix(in_srgb,var(--ds-surface-secondary)_80%,white)]",
        compact ? "h-20 w-20" : "h-full w-full max-w-[11rem] sm:max-w-[12rem]",
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : loading && imageUrl?.trim() ? (
        <div className="h-full w-full animate-pulse bg-ds-interactive-hover" aria-hidden />
      ) : (
        <Package className={cn("text-ds-muted", compact ? "h-8 w-8" : "h-16 w-16")} strokeWidth={1.25} aria-hidden />
      )}
    </div>
  );
}

function ReferenceFields({
  value,
  onChange,
  disabled,
}: {
  value: TransactionReference;
  onChange: (v: TransactionReference) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-ds-border bg-ds-secondary/30 p-4">
      <p className="text-sm font-bold text-ds-foreground">Reference (optional)</p>
      <label className="block">
        <span className={txLabelClass}>Reference type</span>
        <input
          className={txFieldClass}
          disabled={disabled}
          value={value.reference_type}
          onChange={(e) => onChange({ ...value, reference_type: e.target.value })}
          placeholder="e.g. project, cost code"
        />
      </label>
      <label className="block">
        <span className={txLabelClass}>Reference ID</span>
        <input
          className={txFieldClass}
          disabled={disabled}
          value={value.reference_id}
          onChange={(e) => onChange({ ...value, reference_id: e.target.value })}
          placeholder="Identifier"
        />
      </label>
      <label className="block">
        <span className={txLabelClass}>Reference note</span>
        <textarea
          className={cn(txFieldClass, "min-h-[4rem] resize-y")}
          disabled={disabled}
          value={value.reference_note}
          onChange={(e) => onChange({ ...value, reference_note: e.target.value })}
          placeholder="Additional context"
        />
      </label>
    </div>
  );
}

function parseModeParam(value: string | null): TransactionMode | null {
  if (value === "issue" || value === "receive") return value;
  return null;
}

export function InventoryTransactionsApp({ presentation = "dedicated" }: InventoryTransactionsAppProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = parseModeParam(searchParams.get("mode"));

  const [settings, setSettings] = useState<InventoryTransactionSettings | null>(null);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);

  const [screen, setScreen] = useState<Screen>(initialMode ? "search" : "home");
  const [mode, setMode] = useState<TransactionMode | null>(initialMode);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suggestions, setSuggestions] = useState<InventoryScanProduct[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [recent, setRecent] = useState<ScannerRecentItem[]>([]);
  const [popular, setPopular] = useState<InventoryScanProduct[]>([]);

  const [product, setProduct] = useState<InventoryScanProduct | null>(null);
  const [qty, setQty] = useState(1);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [lineReference, setLineReference] = useState<TransactionReference>(emptyReference());
  const [batchReference, setBatchReference] = useState<TransactionReference>(emptyReference());
  const [lines, setLines] = useState<TransactionCartLine[]>([]);

  const { phase: submitPhase, run: runSubmit } = useAsyncSubmitPhase();
  const submitPending = submitPhase === "loading" || submitPhase === "success";
  const [lookupBusy, setLookupBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [countNotice, setCountNotice] = useState<string | null>(null);

  useEffect(() => {
    setRecent(readScannerRecentItems());
    void fetchPopularInventoryProducts(6)
      .then(setPopular)
      .catch(() => setPopular([]));
    void fetchInventoryTransactionSettings().then(setSettings).catch(() => setSettings(null));
    void fetchPulseZonesCached()
      .then((rows) => setZones(rows.map((z) => ({ id: z.id, name: z.name }))))
      .catch(() => setZones([]));
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

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 3200);
    return () => window.clearTimeout(id);
  }, [flash]);

  const txSettings = settings;

  const rememberProduct = useCallback((item: InventoryScanProduct) => {
    setRecent(rememberScannerRecentItem({ id: item.id, sku: item.sku, name: item.name }));
  }, []);

  const resetTransaction = useCallback(() => {
    setProduct(null);
    setQty(1);
    setLocationId(null);
    setLineReference(emptyReference());
    setSubmitErr(null);
  }, []);

  const goHome = useCallback(() => {
    setScreen("home");
    setMode(null);
    resetTransaction();
    setLines([]);
    setBatchReference(emptyReference());
    setSearch("");
    setLookupErr(null);
  }, [resetTransaction]);

  const startMode = useCallback(
    (m: TransactionMode) => {
      setMode(m);
      setScreen("search");
      resetTransaction();
      setLines([]);
      setLookupErr(null);
      setSubmitErr(null);
      window.setTimeout(() => searchRef.current?.focus(), 0);
    },
    [resetTransaction],
  );

  const resolveProduct = useCallback(
    async (input: { sku?: string; row?: InventoryScanProduct }) => {
      setLookupBusy(true);
      setLookupErr(null);
      setSubmitErr(null);
      setSuggestOpen(false);
      try {
        const item = await resolveInventoryProduct(input);
        setSearch("");
        setDebouncedSearch("");
        setSuggestions([]);
        rememberProduct(item);
        setProduct(item);
        setQty(item.item_type === "tool" ? 1 : 1);
        setLocationId(item.zone_id ?? null);
        setScreen(screen === "find" ? "find" : "quantity");
        return item;
      } catch (e) {
        const { message } = parseClientApiError(e);
        setLookupErr(message || "Product not found");
        return null;
      } finally {
        setLookupBusy(false);
      }
    },
    [rememberProduct, screen],
  );

  const handleScan = useCallback(
    (raw: string) => {
      const sku = raw.trim();
      if (!sku || submitPending || !mode) return;
      void resolveProduct({ sku });
    },
    [submitPending, mode, resolveProduct],
  );

  const { inputRef: scannerInputRef, handleKeyDown, handleChange, connectionStatus } =
    useBarcodeScannerInput({ enabled: Boolean(mode) && screen !== "home", onScan: handleScan });

  const submitSearch = () => {
    const q = search.trim();
    if (!q) return;
    if (suggestions.length === 1) {
      void resolveProduct({ row: suggestions[0] });
      return;
    }
    void resolveProduct({ sku: q });
  };

  const modeLabel = mode === "issue" ? "Issue stock" : mode === "receive" ? "Receive stock" : "Inventory";
  const locationLabel = mode === "issue" ? "Source location" : "Destination location";

  const referenceOk = useMemo(() => {
    if (!txSettings?.enable_references || !txSettings.require_reference) return true;
    return referenceFilled(lineReference) || referenceFilled(batchReference);
  }, [txSettings, lineReference, batchReference]);

  const commitSingle = async () => {
    if (!product || !mode || !txSettings || submitPending) return;
    if (!referenceOk) {
      setSubmitErr("Enter a reference before confirming.");
      return;
    }
    setSubmitErr(null);
    try {
      await runSubmit(async () => {
        const ref = txSettings.enable_references ? lineReference : null;
        const result = await commitInventoryTransactionSingle(mode, product, qty, locationId, ref, txSettings);
        rememberProduct(result.product);
        setFlash(
          `${mode === "receive" ? "Received" : "Issued"} ${qty} ${result.product.unit} · On hand ${result.quantity_after}`,
        );
        resetTransaction();
        setScreen("search");
        window.setTimeout(() => searchRef.current?.focus(), 0);
      });
    } catch (e) {
      setSubmitErr(parseClientApiError(e).message || "Transaction failed");
    }
  };

  const addLineToBatch = () => {
    if (!product || !mode) return;
    if (!referenceOk) {
      setSubmitErr("Enter a reference before adding this item.");
      return;
    }
    const ref = txSettings?.enable_references && referenceFilled(lineReference) ? { ...lineReference } : null;
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product.id === product.id && l.location_id === locationId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { product, quantity: qty, location_id: locationId, reference: ref }];
    });
    setFlash(`Added ${qty} ${product.unit} of ${product.name}`);
    resetTransaction();
    setScreen("search");
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const commitBatch = async () => {
    if (!mode || !txSettings || !lines.length || submitPending) return;
    if (txSettings.require_reference && txSettings.enable_references && !referenceFilled(batchReference)) {
      const anyLineRef = lines.some((l) => referenceFilled(l.reference));
      if (!anyLineRef) {
        setSubmitErr("Enter a reference before confirming.");
        return;
      }
    }
    setSubmitErr(null);
    try {
      await runSubmit(async () => {
        const batchRef = txSettings.enable_references && referenceFilled(batchReference) ? batchReference : null;
        await commitInventoryTransactionBatch(mode, lines, batchRef, txSettings);
        setFlash(`${lines.length} line(s) confirmed.`);
        setLines([]);
        setBatchReference(emptyReference());
        setScreen("search");
        resetTransaction();
        window.setTimeout(() => searchRef.current?.focus(), 0);
      });
    } catch (e) {
      setSubmitErr(parseClientApiError(e).message || "Batch transaction failed");
    }
  };

  const onLogout = () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    void performPulseLogout("user").finally(() => setLogoutBusy(false));
  };

  const onBackToInventory = () => {
    if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    router.push(pulseAppHref("/dashboard/inventory"));
  };

  const showQuickPicks = screen === "search" && !product;
  const batchEnabled = txSettings?.enable_batch_transactions !== false;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-ds-bg text-ds-foreground">
      <ScannerConnectionBadge status={connectionStatus} />
      <input
        ref={scannerInputRef}
        type="text"
        inputMode="none"
        autoComplete="off"
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
        onKeyDown={handleKeyDown}
        onChange={handleChange}
      />

      <header className="relative flex shrink-0 items-center justify-between gap-4 border-b border-ds-border/80 bg-ds-primary/90 px-4 py-3 backdrop-blur-sm sm:px-6">
        <TenantBrandMark className="h-11 w-auto shrink-0 sm:h-12" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-24 text-center">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {presentation === "dedicated" ? "Inventory kiosk" : "Inventory transactions"}
          </h1>
          <p className="hidden text-xs text-ds-muted sm:block">{modeLabel}</p>
        </div>
        <div className="relative z-10 shrink-0">
          {presentation === "dedicated" ? (
            <TxBubbleButton
              type="button"
              onClick={onLogout}
              disabled={logoutBusy || submitPending}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Log out
            </TxBubbleButton>
          ) : (
            <TxBubbleButton
              type="button"
              onClick={onBackToInventory}
              disabled={submitPending}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </TxBubbleButton>
          )}
        </div>
      </header>

      {screen !== "home" ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-ds-border/80 bg-ds-secondary/40 px-4 py-2 sm:px-6">
          <TxBubbleButton
            type="button"
            className="px-3 py-2 text-sm font-semibold"
            disabled={submitPending}
            onClick={() => {
              if (screen === "quantity" || screen === "batch") {
                resetTransaction();
                setScreen(mode ? "search" : "home");
                return;
              }
              if (screen === "find") {
                goHome();
                return;
              }
              goHome();
            }}
          >
            <ArrowLeft className="mr-1 inline h-4 w-4" aria-hidden />
            {screen === "search" ? "Home" : "Back"}
          </TxBubbleButton>
          <span className="text-sm font-bold text-ds-foreground">{modeLabel}</span>
          {batchEnabled && lines.length > 0 ? (
            <TxBubbleButton
              type="button"
              className="ml-auto px-3 py-2 text-sm font-semibold"
              disabled={submitPending}
              onClick={() => setScreen("batch")}
            >
              Review ({lines.length})
            </TxBubbleButton>
          ) : null}
        </div>
      ) : null}

      {(screen === "search" || screen === "find") && (
        <ScannerSearchStrip
          value={search}
          onChange={(v) => {
            setSearch(v);
            setLookupErr(null);
          }}
          onSubmit={submitSearch}
          onPickSuggestion={(row) => void resolveProduct({ row })}
          suggestions={suggestions}
          suggestOpen={suggestOpen}
          onSuggestOpen={setSuggestOpen}
          busy={lookupBusy || submitPending}
          inputRef={searchRef}
          label={screen === "find" ? "Find item" : "Scan or search item"}
          placeholder="Name, SKU, or scan barcode…"
        />
      )}

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {flash ? (
            <p className="rounded-xl border border-[color-mix(in_srgb,var(--ds-success)_40%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-success)_12%,var(--ds-bg))] px-4 py-3 text-center text-sm font-medium sm:text-base">
              {flash}
            </p>
          ) : null}
          {countNotice ? (
            <p className="rounded-xl border border-ds-border bg-ds-secondary/40 px-4 py-3 text-center text-sm">{countNotice}</p>
          ) : null}
          {lookupErr ? (
            <p className="rounded-xl border border-[color-mix(in_srgb,var(--ds-danger)_40%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-danger)_10%,var(--ds-bg))] px-4 py-3 text-center text-sm sm:text-base">
              {lookupErr}
            </p>
          ) : null}
          {submitErr ? (
            <p className="rounded-xl border border-[color-mix(in_srgb,var(--ds-danger)_40%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-danger)_8%,var(--ds-bg))] px-4 py-3 text-center text-sm sm:text-base">
              {submitErr}
            </p>
          ) : null}

          {screen === "home" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TxHomeTile
                label="Issue stock"
                description="Remove items from a location"
                className={txBubbleIssue}
                onClick={() => startMode("issue")}
                disabled={submitPending}
              />
              <TxHomeTile
                label="Receive stock"
                description="Add items to a location"
                className={txBubbleReceive}
                onClick={() => startMode("receive")}
                disabled={submitPending}
              />
              <TxHomeTile
                label="Find item"
                description="Look up SKU and on-hand qty"
                onClick={() => {
                  setScreen("find");
                  setMode(null);
                  resetTransaction();
                  window.setTimeout(() => searchRef.current?.focus(), 0);
                }}
                disabled={submitPending}
              />
              <TxHomeTile
                label="Inventory count"
                description="Cycle counts (coming soon)"
                onClick={() => {
                  setCountNotice("Inventory counts are coming soon. Use Issue or Receive for stock changes.");
                  window.setTimeout(() => setCountNotice(null), 4000);
                }}
                disabled={submitPending}
              />
            </div>
          ) : null}

          {screen === "find" && product ? (
            <Card variant="secondary" padding="lg" className="w-full">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <ProductPhoto imageUrl={product.image_url} name={product.name} compact />
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="text-xl font-bold">{product.name}</h2>
                  <p className="text-sm text-ds-muted">
                    {product.sku} · {product.quantity} {product.unit} on hand
                  </p>
                  <p className="flex items-center gap-2 text-sm text-ds-muted">
                    <MapPin className="h-4 w-4" aria-hidden />
                    {product.location_name || "No location"}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {screen === "quantity" && product && mode ? (
            <Card variant="secondary" padding="lg" className="w-full">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <ProductPhoto imageUrl={product.image_url} name={product.name} compact />
                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-ds-muted">{modeLabel}</p>
                    <h2 className="text-xl font-bold text-ds-foreground">{product.name}</h2>
                    <p className="text-sm text-ds-muted">
                      {product.sku} · {product.quantity} {product.unit} on hand
                    </p>
                  </div>
                  {product.item_type !== "tool" ? (
                    <TxQtyStepper quantity={qty} onChange={setQty} busy={submitPending} />
                  ) : (
                    <p className="text-sm text-ds-muted">Tools issue one at a time.</p>
                  )}
                  {txSettings?.enable_location_selection && zones.length > 0 ? (
                    <label className="block">
                      <span className={txLabelClass}>{locationLabel}</span>
                      <select
                        className={txFieldClass}
                        disabled={submitPending}
                        value={locationId ?? ""}
                        onChange={(e) => setLocationId(e.target.value || null)}
                      >
                        <option value="">— Select location —</option>
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {txSettings?.enable_references ? (
                    <ReferenceFields value={lineReference} onChange={setLineReference} disabled={submitPending} />
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <AsyncSubmitButton
                      phase={submitPhase}
                      idleLabel="Confirm transaction"
                      loadingLabel="Saving"
                      disabled={submitPending || !referenceOk}
                      onClick={() => void commitSingle()}
                      className={cn(txBubblePrimary, "min-h-[3.25rem] flex-1 px-4 py-4 text-base font-bold")}
                    />
                    {batchEnabled ? (
                      <TxBubbleButton
                        type="button"
                        className="min-h-[3.25rem] flex-1 px-4 py-4 text-base font-semibold"
                        disabled={submitPending || !referenceOk}
                        onClick={addLineToBatch}
                      >
                        Add another item
                      </TxBubbleButton>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {screen === "batch" && mode ? (
            <section className="space-y-4">
              <h2 className="text-lg font-bold">Review transaction</h2>
              <ul className="space-y-2">
                {lines.map((line, idx) => (
                  <li
                    key={`${line.product.id}-${line.location_id ?? "x"}-${idx}`}
                    className="flex items-center gap-3 rounded-xl border border-ds-border bg-ds-primary/80 p-3"
                  >
                    <ProductPhoto imageUrl={line.product.image_url} name={line.product.name} compact />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{line.product.name}</p>
                      <p className="text-xs text-ds-muted">
                        {line.product.sku} · Qty {line.quantity} {line.product.unit} ·{" "}
                        {mode === "issue" ? "Issue" : "Receive"}
                      </p>
                      {line.location_id ? (
                        <p className="text-xs text-ds-muted">
                          {zones.find((z) => z.id === line.location_id)?.name ?? "Location"}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-danger"
                      aria-label={`Remove ${line.product.name}`}
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </li>
                ))}
              </ul>
              {txSettings?.enable_references ? (
                <ReferenceFields value={batchReference} onChange={setBatchReference} disabled={submitPending} />
              ) : null}
              <TxBubbleButton
                type="button"
                disabled={submitPending || !lines.length}
                onClick={() => void commitBatch()}
                className={cn(txBubblePrimary, "w-full py-4 text-lg font-bold")}
              >
                {submitPending ? "Processing…" : "Confirm all"}
              </TxBubbleButton>
            </section>
          ) : null}

          {showQuickPicks ? (
            <>
              {recent.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ds-muted">
                    <Clock className="h-4 w-4" />
                    Recent
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recent.map((item) => (
                      <TxBubbleButton
                        key={item.id}
                        type="button"
                        onClick={() => void resolveProduct({ sku: item.sku })}
                        className="flex min-w-0 flex-col px-5 py-4 text-left"
                      >
                        <span className="truncate text-lg font-semibold">{item.name}</span>
                        <span className="truncate text-base text-ds-muted">{item.sku}</span>
                      </TxBubbleButton>
                    ))}
                  </div>
                </section>
              ) : null}
              {popular.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ds-muted">
                    <TrendingUp className="h-4 w-4" />
                    Popular
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {popular.map((item) => (
                      <TxBubbleButton
                        key={item.id}
                        type="button"
                        onClick={() => void resolveProduct({ row: item })}
                        className="flex min-w-0 flex-col px-5 py-4 text-left"
                      >
                        <span className="truncate text-lg font-semibold">{item.name}</span>
                        <span className="truncate text-base text-ds-muted">
                          {item.sku} · {item.quantity} {item.unit}
                        </span>
                      </TxBubbleButton>
                    ))}
                  </div>
                </section>
              ) : null}
              {screen === "search" && !product ? (
                <p className="text-center text-sm text-ds-muted">Scan or search to select an item.</p>
              ) : null}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/** @deprecated Use InventoryTransactionsApp */
export const InventoryScannerKiosk = InventoryTransactionsApp;
export type InventoryScannerPresentation = InventoryTransactionsPresentation;
