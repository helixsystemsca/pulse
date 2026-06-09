"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LogOut, MapPin, Package, Search } from "lucide-react";

import { Card } from "@/components/pulse/Card";
import { TenantBrandMark } from "@/components/branding/TenantBrandMark";
import { CheckoutCartPanel } from "@/components/inventory-transactions/CheckoutCartPanel";
import {
  CheckoutMaterialRow,
  CheckoutSectionLabel,
  Clock,
  TrendingUp,
} from "@/components/inventory-transactions/checkout-ui";
import { ScannerSearchStrip } from "@/components/inventory-scanner/ScannerSearchStrip";
import { TxBubbleButton } from "@/components/inventory-transactions/transaction-ui";
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
import { useAsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";

export type InventoryTransactionsPresentation = "dedicated" | "staff";

type Screen = "checkout" | "find";

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

function FindProductCard({ product }: { product: InventoryScanProduct }) {
  const { src, loading } = useResolvedProtectedAssetSrc(product.image_url);
  return (
    <Card variant="secondary" padding="lg" className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-ds-border bg-ds-secondary/60">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : loading && product.image_url?.trim() ? (
            <div className="h-full w-full animate-pulse bg-ds-interactive-hover" aria-hidden />
          ) : (
            <Package className="h-8 w-8 text-ds-muted" strokeWidth={1.25} aria-hidden />
          )}
        </div>
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
  );
}

function parseModeParam(value: string | null): TransactionMode {
  return value === "receive" ? "receive" : "issue";
}

function recentAsProducts(recent: ScannerRecentItem[], popular: InventoryScanProduct[]): InventoryScanProduct[] {
  const bySku = new Map(popular.map((p) => [p.sku, p]));
  return recent
    .map((item) => bySku.get(item.sku))
    .filter((p): p is InventoryScanProduct => p != null);
}

export function InventoryTransactionsApp({ presentation = "dedicated" }: InventoryTransactionsAppProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [settings, setSettings] = useState<InventoryTransactionSettings | null>(null);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);

  const [screen, setScreen] = useState<Screen>("checkout");
  const [mode, setMode] = useState<TransactionMode>(parseModeParam(searchParams.get("mode")));

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suggestions, setSuggestions] = useState<InventoryScanProduct[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [recent, setRecent] = useState<ScannerRecentItem[]>([]);
  const [popular, setPopular] = useState<InventoryScanProduct[]>([]);
  const [findProduct, setFindProduct] = useState<InventoryScanProduct | null>(null);

  const [batchReference, setBatchReference] = useState<TransactionReference>(emptyReference());
  const [lines, setLines] = useState<TransactionCartLine[]>([]);

  const { phase: submitPhase, run: runSubmit } = useAsyncSubmitPhase();
  const submitPending = submitPhase === "loading" || submitPhase === "success";
  const [lookupBusy, setLookupBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setRecent(readScannerRecentItems());
    void fetchPopularInventoryProducts(8)
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
    void searchInventoryProducts(debouncedSearch, 12)
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
    const id = window.setTimeout(() => setFlash(null), 2800);
    return () => window.clearTimeout(id);
  }, [flash]);

  const rememberProduct = useCallback((item: InventoryScanProduct) => {
    setRecent(rememberScannerRecentItem({ id: item.id, sku: item.sku, name: item.name }));
  }, []);

  const addToCart = useCallback(
    (item: InventoryScanProduct) => {
      rememberProduct(item);
      const locationId = item.zone_id ?? null;
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.product.id === item.id && l.location_id === locationId);
        if (idx >= 0) {
          const next = [...prev];
          const cap =
            mode === "issue" && item.item_type !== "tool" ? Math.max(1, item.quantity) : 9999;
          next[idx] = {
            ...next[idx],
            quantity: Math.min(cap, next[idx].quantity + (item.item_type === "tool" ? 1 : 1)),
          };
          return next;
        }
        return [
          ...prev,
          {
            product: item,
            quantity: 1,
            location_id: locationId,
            reference: null,
          },
        ];
      });
      setFlash(`Added ${item.name}`);
      setLookupErr(null);
    },
    [mode, rememberProduct],
  );

  const resolveProduct = useCallback(
    async (input: { sku?: string; row?: InventoryScanProduct }, target: Screen) => {
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
        if (target === "find") {
          setFindProduct(item);
          setScreen("find");
        } else {
          addToCart(item);
        }
        return item;
      } catch (e) {
        const { message } = parseClientApiError(e);
        setLookupErr(message || "Product not found");
        return null;
      } finally {
        setLookupBusy(false);
      }
    },
    [addToCart, rememberProduct],
  );

  const handleScan = useCallback(
    (raw: string) => {
      const sku = raw.trim();
      if (!sku || submitPending) return;
      void resolveProduct({ sku }, screen === "find" ? "find" : "checkout");
    },
    [submitPending, resolveProduct, screen],
  );

  const { inputRef: scannerInputRef, handleKeyDown, handleChange, connectionStatus } =
    useBarcodeScannerInput({ enabled: true, onScan: handleScan });

  const submitSearch = (target: Screen = screen) => {
    const q = search.trim();
    if (!q) return;
    if (suggestions.length === 1) {
      void resolveProduct({ row: suggestions[0] }, target);
      return;
    }
    void resolveProduct({ sku: q }, target);
  };

  const referenceOk = useMemo(() => {
    if (!settings?.enable_references || !settings.require_reference) return true;
    if (referenceFilled(batchReference)) return true;
    return lines.some((l) => referenceFilled(l.reference));
  }, [settings, batchReference, lines]);

  const commitCart = async () => {
    if (!settings || !lines.length || submitPending) return;
    if (!referenceOk) {
      setSubmitErr("Enter a reference before confirming.");
      return;
    }
    setSubmitErr(null);
    try {
      await runSubmit(async () => {
        const batchRef = settings.enable_references && referenceFilled(batchReference) ? batchReference : null;
        await commitInventoryTransactionBatch(mode, lines, batchRef, settings);
        const count = lines.reduce((sum, line) => sum + line.quantity, 0);
        setFlash(`${mode === "receive" ? "Received" : "Issued"} ${count} item${count === 1 ? "" : "s"}.`);
        setLines([]);
        setBatchReference(emptyReference());
        void fetchPopularInventoryProducts(8)
          .then(setPopular)
          .catch(() => setPopular([]));
      });
    } catch (e) {
      setSubmitErr(parseClientApiError(e).message || "Transaction failed");
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

  const recentProducts = useMemo(() => {
    const fromPopular = recentAsProducts(recent, popular);
    if (fromPopular.length) return fromPopular;
    return recent.map(
      (item) =>
        ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          item_type: "consumable",
          category: null,
          inv_status: "active",
          quantity: 0,
          unit: "ea",
          low_stock_threshold: 0,
          location_name: null,
          image_url: null,
          department_slug: "",
        }) satisfies InventoryScanProduct,
    );
  }, [recent, popular]);

  const searchResults = debouncedSearch ? suggestions : [];

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

      <header className="relative flex shrink-0 items-center justify-between gap-3 border-b border-ds-border/80 bg-ds-primary/90 px-4 py-3 backdrop-blur-sm sm:px-5">
        <TenantBrandMark className="h-10 w-auto shrink-0 sm:h-11" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-20 text-center">
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            {presentation === "dedicated" ? "Inventory checkout" : "Inventory transactions"}
          </h1>
          <p className="hidden text-xs text-ds-muted sm:block">Issue and receive from one screen</p>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          {screen === "find" ? (
            <TxBubbleButton
              type="button"
              className="px-3 py-2 text-sm font-semibold"
              disabled={submitPending}
              onClick={() => {
                setScreen("checkout");
                setFindProduct(null);
                setLookupErr(null);
              }}
            >
              Checkout
            </TxBubbleButton>
          ) : (
            <TxBubbleButton
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold"
              disabled={submitPending}
              onClick={() => {
                setScreen("find");
                setFindProduct(null);
                window.setTimeout(() => searchRef.current?.focus(), 0);
              }}
            >
              <Search className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Find</span>
            </TxBubbleButton>
          )}
          {presentation === "dedicated" ? (
            <TxBubbleButton
              type="button"
              onClick={onLogout}
              disabled={logoutBusy || submitPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Log out</span>
            </TxBubbleButton>
          ) : (
            <TxBubbleButton
              type="button"
              onClick={onBackToInventory}
              disabled={submitPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Back</span>
            </TxBubbleButton>
          )}
        </div>
      </header>

      <ScannerSearchStrip
        value={search}
        onChange={(v) => {
          setSearch(v);
          setLookupErr(null);
        }}
        onSubmit={() => submitSearch()}
        onPickSuggestion={(row) => void resolveProduct({ row }, screen)}
        suggestions={suggestions}
        suggestOpen={suggestOpen}
        onSuggestOpen={setSuggestOpen}
        busy={lookupBusy || submitPending}
        inputRef={searchRef}
        label={screen === "find" ? "Find item" : "Materials"}
        placeholder="Search by name, SKU, or scan barcode…"
      />

      {(flash || lookupErr || submitErr) && (
        <div className="shrink-0 space-y-2 px-4 py-2 sm:px-5">
          {flash ? (
            <p className="rounded-xl border border-[color-mix(in_srgb,var(--ds-success)_40%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-success)_12%,var(--ds-bg))] px-4 py-2.5 text-center text-sm font-medium">
              {flash}
            </p>
          ) : null}
          {lookupErr ? (
            <p className="rounded-xl border border-[color-mix(in_srgb,var(--ds-danger)_40%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-danger)_10%,var(--ds-bg))] px-4 py-2.5 text-center text-sm">
              {lookupErr}
            </p>
          ) : null}
          {submitErr ? (
            <p className="rounded-xl border border-[color-mix(in_srgb,var(--ds-danger)_40%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-danger)_8%,var(--ds-bg))] px-4 py-2.5 text-center text-sm">
              {submitErr}
            </p>
          ) : null}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col lg:max-w-[58%]">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {screen === "find" && findProduct ? (
              <FindProductCard product={findProduct} />
            ) : (
              <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 lg:max-w-none">
                {searchResults.length > 0 ? (
                  <div className="space-y-2">
                    <CheckoutSectionLabel icon={Search}>Search results</CheckoutSectionLabel>
                    <div className="space-y-2">
                      {searchResults.map((item) => (
                        <CheckoutMaterialRow
                          key={item.id}
                          product={item}
                          disabled={submitPending || lookupBusy}
                          onSelect={() => addToCart(item)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {popular.length > 0 && !debouncedSearch ? (
                  <div className="space-y-2">
                    <CheckoutSectionLabel icon={TrendingUp}>Top used</CheckoutSectionLabel>
                    <div className="space-y-2">
                      {popular.map((item) => (
                        <CheckoutMaterialRow
                          key={item.id}
                          product={item}
                          disabled={submitPending || lookupBusy}
                          onSelect={() => addToCart(item)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {recentProducts.length > 0 && !debouncedSearch ? (
                  <div className="space-y-2">
                    <CheckoutSectionLabel icon={Clock}>Recently issued</CheckoutSectionLabel>
                    <div className="space-y-2">
                      {recentProducts.map((item) => (
                        <CheckoutMaterialRow
                          key={`${item.id}-${item.sku}`}
                          product={item}
                          disabled={submitPending || lookupBusy}
                          onSelect={() => void resolveProduct({ row: item }, "checkout")}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {!debouncedSearch && !popular.length && !recentProducts.length ? (
                  <p className="py-8 text-center text-sm text-ds-muted">
                    Search or scan a barcode to add materials to your transaction.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </section>

        {screen === "checkout" ? (
          <CheckoutCartPanel
            className="lg:max-w-[42%] lg:shrink-0"
            mode={mode}
            onModeChange={setMode}
            lines={lines}
            onUpdateLineQty={(index, quantity) => {
              setLines((prev) => {
                const next = [...prev];
                const line = next[index];
                if (!line) return prev;
                const cap =
                  mode === "issue" && line.product.item_type !== "tool"
                    ? Math.max(1, line.product.quantity)
                    : 9999;
                next[index] = { ...line, quantity: Math.max(1, Math.min(cap, quantity)) };
                return next;
              });
            }}
            onUpdateLineLocation={(index, locationId) => {
              setLines((prev) => {
                const next = [...prev];
                const line = next[index];
                if (!line) return prev;
                next[index] = { ...line, location_id: locationId };
                return next;
              });
            }}
            onRemoveLine={(index) => setLines((prev) => prev.filter((_, i) => i !== index))}
            zones={zones}
            settings={settings}
            batchReference={batchReference}
            onBatchReferenceChange={setBatchReference}
            onConfirm={() => void commitCart()}
            submitPhase={submitPhase}
            submitPending={submitPending}
          />
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated Use InventoryTransactionsApp */
export const InventoryScannerKiosk = InventoryTransactionsApp;
export type InventoryScannerPresentation = InventoryTransactionsPresentation;
