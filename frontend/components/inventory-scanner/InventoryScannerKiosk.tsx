"use client";

import { useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  LogOut,
  MapPin,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Truck,
} from "lucide-react";

import { Card } from "@/components/pulse/Card";
import { TenantBrandMark } from "@/components/branding/TenantBrandMark";
import { ScannerSearchStrip } from "@/components/inventory-scanner/ScannerSearchStrip";

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
import { pulseAppHref } from "@/lib/pulse-app";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cn } from "@/lib/cn";
import { useResolvedProtectedAssetSrc } from "@/lib/useResolvedProtectedAssetSrc";

type ScanAction = "receive" | "issue";
type KioskTab = "checkout" | "receive";

export type InventoryScannerPresentation = "dedicated" | "staff";

type CartLine = {
  product: InventoryScanProduct;
  quantity: number;
};

type InventoryScannerKioskProps = {
  presentation?: InventoryScannerPresentation;
};

const SCANNER_LOBSTER = "#e85d6f";
const BTN_RADIUS = "rounded-xl";
const BTN_RADIUS_SM = "rounded-lg";

function scannerHaptic(ms = 14) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(ms);
  }
}

const bubbleStroke = "border-2 border-[color-mix(in_srgb,var(--ds-text-primary)_28%,var(--ds-border))]";
const bubbleDepth =
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-2px_4px_rgba(15,23,42,0.07)] active:translate-y-px active:shadow-[inset_0_3px_8px_rgba(15,23,42,0.14)]";

const bubbleBase = cn(
  "relative overflow-hidden transition-[transform,box-shadow,background-color] duration-100 disabled:pointer-events-none disabled:opacity-45",
  bubbleStroke,
  bubbleDepth,
);

const bubbleIdle = cn(
  bubbleBase,
  BTN_RADIUS,
  "bg-[color-mix(in_srgb,var(--ds-surface-elevated)_88%,white)] text-ds-foreground",
);

const bubbleActiveReceive = cn(
  bubbleBase,
  BTN_RADIUS,
  "border-[var(--ds-success)]",
  "bg-gradient-to-b from-[color-mix(in_srgb,var(--ds-success)_22%,white)] to-[color-mix(in_srgb,var(--ds-success)_8%,var(--ds-surface-secondary))]",
  "text-[color-mix(in_srgb,var(--ds-success)_85%,#0f172a)]",
);

const bubbleActiveIssue = cn(
  bubbleBase,
  BTN_RADIUS,
  "border-[#e85d6f]",
  "bg-gradient-to-b from-[color-mix(in_srgb,#e85d6f_20%,white)] to-[color-mix(in_srgb,#e85d6f_8%,var(--ds-surface-secondary))]",
  "text-[color-mix(in_srgb,#e85d6f_88%,#0f172a)]",
);

const bubblePrimary = cn(
  bubbleBase,
  BTN_RADIUS,
  "border-[color-mix(in_srgb,var(--ds-accent)_75%,#0f172a)]",
  "bg-gradient-to-b from-[color-mix(in_srgb,var(--ds-accent)_92%,#38bdf8)] to-[color-mix(in_srgb,var(--ds-accent)_78%,#0284c7)]",
  "text-white",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-3px_6px_rgba(0,0,0,0.18)]",
);

const bubbleCircle = cn(bubbleIdle, BTN_RADIUS, "flex shrink-0 items-center justify-center !p-0");

const quickPickClass = cn(bubbleIdle, BTN_RADIUS_SM, "flex min-w-0 flex-col px-5 py-4 text-left");

type ScannerBubbleButtonProps = ComponentPropsWithoutRef<"button">;

function ScannerBubbleButton({ className, disabled, onPointerDown, ...rest }: ScannerBubbleButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={className}
      onPointerDown={(e) => {
        if (!disabled) scannerHaptic();
        onPointerDown?.(e);
      }}
    />
  );
}

function ScannerConnectionBadge({ status }: { status: ScannerConnectionStatus }) {
  const connected = status === "connected";
  const statusColor = connected ? "var(--ds-success)" : SCANNER_LOBSTER;
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

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function ProductPhoto({ imageUrl, name, compact }: { imageUrl: string | null; name: string; compact?: boolean }) {
  const { src, loading } = useResolvedProtectedAssetSrc(imageUrl);
  return (
    <div
      className={cn(
        "relative flex aspect-square shrink-0 items-center justify-center overflow-hidden",
        BTN_RADIUS,
        "border-2 border-ds-border bg-[color-mix(in_srgb,var(--ds-surface-secondary)_80%,white)]",
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

function ProductDetailCard({
  product,
  busy,
  onBack,
}: {
  product: InventoryScanProduct;
  busy: boolean;
  onBack: () => void;
}) {
  const meta = [product.category, product.item_type, statusLabel(product.inv_status)].filter(Boolean).join(" · ");

  return (
    <Card variant="secondary" padding="lg" className="w-full">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ds-muted">Product details</p>
        <ScannerBubbleButton
          type="button"
          disabled={busy}
          onClick={onBack}
          aria-label="Clear selection"
          className={cn(bubbleIdle, BTN_RADIUS_SM, "flex h-10 w-10 shrink-0 items-center justify-center !p-0")}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </ScannerBubbleButton>
      </div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <ProductPhoto imageUrl={product.image_url} name={product.name} />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="text-2xl font-bold leading-tight text-ds-foreground sm:text-3xl">{product.name}</h2>
            {meta ? <p className="mt-1 text-sm text-ds-muted sm:text-base">{meta}</p> : null}
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ds-muted">Item #</dt>
              <dd className="font-mono text-lg font-semibold text-ds-foreground">{product.sku}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ds-muted">On hand</dt>
              <dd className="text-lg font-semibold text-ds-foreground">
                {product.quantity} <span className="text-base font-medium text-ds-muted">{product.unit}</span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-ds-muted">Location</dt>
              <dd className="flex items-center gap-2 text-lg font-medium text-ds-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
                {product.location_name?.trim() || "Not assigned"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>
  );
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
    <ScannerBubbleButton type="button" onClick={onSelect} className={quickPickClass}>
      <span className="truncate text-lg font-semibold text-ds-foreground">{item.name}</span>
      <span className="truncate text-base text-ds-muted">
        {item.sku}
        {meta ? ` · ${meta}` : ""}
      </span>
    </ScannerBubbleButton>
  );
}

function QtyStepper({
  quantity,
  onChange,
  busy,
  max,
}: {
  quantity: number;
  onChange: (q: number) => void;
  busy?: boolean;
  max?: number;
}) {
  const adjust = (delta: number) => {
    const next = Math.max(1, Math.round((quantity + delta) * 1000) / 1000);
    onChange(max != null ? Math.min(max, next) : next);
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <ScannerBubbleButton
        type="button"
        aria-label="Decrease quantity"
        disabled={busy}
        onClick={() => adjust(-1)}
        className={cn(bubbleCircle, "h-16 w-16 sm:h-20 sm:w-20")}
      >
        <Minus className="h-8 w-8" />
      </ScannerBubbleButton>
      <input
        type="number"
        min={1}
        max={max}
        step={1}
        inputMode="decimal"
        value={quantity}
        disabled={busy}
        data-scanner-manual-input="true"
        onChange={(e) => {
          const n = Number(e.target.value);
          const v = Number.isFinite(n) && n > 0 ? n : 1;
          onChange(max != null ? Math.min(max, v) : v);
        }}
        className={cn(
          "h-16 w-28 rounded-xl border-2 border-ds-border bg-white/80 text-center text-3xl font-bold text-ds-foreground sm:h-20 sm:w-32 sm:text-4xl",
        )}
      />
      <ScannerBubbleButton
        type="button"
        aria-label="Increase quantity"
        disabled={busy}
        onClick={() => adjust(1)}
        className={cn(bubbleCircle, "h-16 w-16 sm:h-20 sm:w-20")}
      >
        <Plus className="h-8 w-8" />
      </ScannerBubbleButton>
    </div>
  );
}

export function InventoryScannerKiosk({ presentation = "dedicated" }: InventoryScannerKioskProps) {
  const router = useRouter();
  const [tab, setTab] = useState<KioskTab>("checkout");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suggestions, setSuggestions] = useState<InventoryScanProduct[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [recent, setRecent] = useState<ScannerRecentItem[]>([]);
  const [popular, setPopular] = useState<InventoryScanProduct[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [staging, setStaging] = useState<InventoryScanProduct | null>(null);
  const [stagingQty, setStagingQty] = useState(1);

  const [receiveProduct, setReceiveProduct] = useState<InventoryScanProduct | null>(null);
  const [receiveAction, setReceiveAction] = useState<ScanAction>("receive");
  const [receiveQty, setReceiveQty] = useState(1);

  const [busy, setBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

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

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 3200);
    return () => window.clearTimeout(id);
  }, [flash]);

  const rememberProduct = useCallback((item: InventoryScanProduct) => {
    setRecent(rememberScannerRecentItem({ id: item.id, sku: item.sku, name: item.name }));
  }, []);

  const resolveProduct = useCallback(
    async (input: { sku?: string; row?: InventoryScanProduct }) => {
      setBusy(true);
      setLookupErr(null);
      setSubmitErr(null);
      setSuggestOpen(false);
      try {
        const item = await resolveInventoryProduct(input);
        setSearch("");
        setDebouncedSearch("");
        setSuggestions([]);
        rememberProduct(item);
        return item;
      } catch (e) {
        const { message } = parseClientApiError(e);
        setLookupErr(message || "Product not found");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [rememberProduct],
  );

  const pickForCheckout = useCallback(
    async (input: { sku?: string; row?: InventoryScanProduct }) => {
      const item = await resolveProduct(input);
      if (!item) return;
      setStaging(item);
      setStagingQty(item.item_type === "tool" ? 1 : 1);
    },
    [resolveProduct],
  );

  const pickForReceive = useCallback(
    async (input: { sku?: string; row?: InventoryScanProduct }) => {
      const item = await resolveProduct(input);
      if (!item) return;
      setReceiveProduct(item);
      setReceiveAction("receive");
      setReceiveQty(1);
    },
    [resolveProduct],
  );

  const handleScan = useCallback(
    (raw: string) => {
      const sku = raw.trim();
      if (!sku || busy) return;
      if (tab === "checkout") void pickForCheckout({ sku });
      else void pickForReceive({ sku });
    },
    [busy, pickForCheckout, pickForReceive, tab],
  );

  const { inputRef: scannerInputRef, handleKeyDown, handleChange, connectionStatus } =
    useBarcodeScannerInput({ enabled: true, onScan: handleScan });

  const submitSearch = () => {
    const q = search.trim();
    if (!q) return;
    if (suggestions.length === 1) {
      const row = suggestions[0];
      if (tab === "checkout") void pickForCheckout({ row });
      else void pickForReceive({ row });
      return;
    }
    if (tab === "checkout") void pickForCheckout({ sku: q });
    else void pickForReceive({ sku: q });
  };

  const addToCart = () => {
    if (!staging) return;
    const qty = staging.item_type === "tool" ? 1 : stagingQty;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product.id === staging.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { product: staging, quantity: qty }];
    });
    setStaging(null);
    setStagingQty(1);
    setFlash(`Added ${qty} ${staging.unit} of ${staging.name}`);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const removeCartLine = (id: string) => {
    setCart((prev) => prev.filter((l) => l.product.id !== id));
  };

  const completeCheckout = async () => {
    if (!cart.length || busy) return;
    setBusy(true);
    setSubmitErr(null);
    try {
      let lastFlash = "";
      for (const line of cart) {
        const result = await postInventoryScanTransaction({
          sku: line.product.sku,
          action: "issue",
          quantity: line.quantity,
        });
        rememberProduct(result.item);
        lastFlash = `Issued ${line.quantity} ${line.product.unit} · ${line.product.name}`;
      }
      setCart([]);
      setFlash(`${cart.length} line(s) checked out. ${lastFlash}`);
      window.setTimeout(() => searchRef.current?.focus(), 0);
    } catch (e) {
      setSubmitErr(parseClientApiError(e).message || "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const submitReceive = async () => {
    if (!receiveProduct || busy) return;
    setBusy(true);
    setSubmitErr(null);
    try {
      const result = await postInventoryScanTransaction({
        sku: receiveProduct.sku,
        action: receiveAction,
        quantity: receiveQty,
      });
      rememberProduct(result.item);
      setFlash(
        `${receiveAction === "receive" ? "Received" : "Issued"} ${receiveQty} ${result.item.unit} · On hand ${result.quantity_after}`,
      );
      setReceiveProduct(null);
      setReceiveQty(1);
      window.setTimeout(() => searchRef.current?.focus(), 0);
    } catch (e) {
      setSubmitErr(parseClientApiError(e).message || "Could not complete transaction");
    } finally {
      setBusy(false);
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

  const cartCount = cart.reduce((n, l) => n + l.quantity, 0);
  const showQuickPicks = !staging && !receiveProduct;

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
            {presentation === "dedicated" ? "Inventory kiosk" : "Self checkout"}
          </h1>
          <p className="hidden text-xs text-ds-muted sm:block">Checkout or receive stock</p>
        </div>
        <div className="relative z-10 shrink-0">
          {presentation === "dedicated" ? (
            <ScannerBubbleButton
              type="button"
              onClick={onLogout}
              disabled={logoutBusy || busy}
              className={cn(bubbleIdle, BTN_RADIUS_SM, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold")}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Log out
            </ScannerBubbleButton>
          ) : (
            <ScannerBubbleButton
              type="button"
              onClick={onBackToInventory}
              disabled={busy}
              className={cn(bubbleIdle, BTN_RADIUS_SM, "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold")}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </ScannerBubbleButton>
          )}
        </div>
      </header>

      <nav
        className="flex shrink-0 gap-1 border-b border-ds-border/80 bg-ds-secondary/40 px-4 py-2 sm:px-6"
        aria-label="Kiosk mode"
      >
        {(
          [
            { id: "checkout" as const, label: "Checkout", icon: ShoppingCart },
            { id: "receive" as const, label: "Receive", icon: Truck },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setLookupErr(null);
              setSubmitErr(null);
              setStaging(null);
              setReceiveProduct(null);
            }}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition sm:flex-none sm:px-6",
              tab === id
                ? "bg-ds-accent text-ds-accent-foreground shadow-sm"
                : "text-ds-muted hover:bg-ds-interactive-hover",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
            {id === "checkout" && cart.length > 0 ? (
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs tabular-nums">{cartCount}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <ScannerSearchStrip
        value={search}
        onChange={(v) => {
          setSearch(v);
          setLookupErr(null);
        }}
        onSubmit={submitSearch}
        onPickSuggestion={(row) => {
          if (tab === "checkout") void pickForCheckout({ row });
          else void pickForReceive({ row });
        }}
        suggestions={suggestions}
        suggestOpen={suggestOpen}
        onSuggestOpen={setSuggestOpen}
        busy={busy}
        inputRef={searchRef}
        label={tab === "checkout" ? "Scan or search to add items" : "Scan or search product"}
        placeholder="Name, SKU, or scan barcode…"
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {flash ? (
            <p className="rounded-xl border border-[color-mix(in_srgb,var(--ds-success)_40%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-success)_12%,var(--ds-bg))] px-4 py-3 text-center text-sm font-medium sm:text-base">
              {flash}
            </p>
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

          {tab === "checkout" ? (
            <>
              {staging ? (
                <Card variant="secondary" padding="lg" className="w-full">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <ProductPhoto imageUrl={staging.image_url} name={staging.name} compact />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-ds-muted">Add to cart</p>
                        <h2 className="text-xl font-bold text-ds-foreground">{staging.name}</h2>
                        <p className="text-sm text-ds-muted">
                          {staging.sku} · {staging.quantity} {staging.unit} on hand
                        </p>
                      </div>
                      {staging.item_type !== "tool" ? (
                        <QtyStepper quantity={stagingQty} onChange={setStagingQty} busy={busy} />
                      ) : (
                        <p className="text-sm text-ds-muted">Tracked tools issue one at a time.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <ScannerBubbleButton
                          type="button"
                          className={cn(bubblePrimary, "flex-1 px-4 py-3 text-base font-bold sm:flex-none")}
                          disabled={busy}
                          onClick={addToCart}
                        >
                          Add to cart
                        </ScannerBubbleButton>
                        <ScannerBubbleButton
                          type="button"
                          className={cn(bubbleIdle, "px-4 py-3 text-sm font-semibold")}
                          disabled={busy}
                          onClick={() => setStaging(null)}
                        >
                          Cancel
                        </ScannerBubbleButton>
                      </div>
                    </div>
                  </div>
                </Card>
              ) : null}

              {cart.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-ds-foreground">Cart</h2>
                    <span className="text-sm text-ds-muted tabular-nums">
                      {cart.length} item{cart.length === 1 ? "" : "s"} · {cartCount} units
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {cart.map((line) => (
                      <li
                        key={line.product.id}
                        className="flex items-center gap-3 rounded-xl border border-ds-border bg-ds-primary/80 p-3"
                      >
                        <ProductPhoto imageUrl={line.product.image_url} name={line.product.name} compact />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-ds-foreground">{line.product.name}</p>
                          <p className="text-xs text-ds-muted">
                            {line.product.sku} · Qty {line.quantity} {line.product.unit}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-danger"
                          aria-label={`Remove ${line.product.name}`}
                          onClick={() => removeCartLine(line.product.id)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <ScannerBubbleButton
                    type="button"
                    disabled={busy}
                    onClick={() => void completeCheckout()}
                    className={cn(bubblePrimary, "w-full py-4 text-lg font-bold")}
                  >
                    {busy ? "Processing…" : "Complete checkout"}
                  </ScannerBubbleButton>
                </section>
              ) : (
                !staging && (
                  <p className="text-center text-sm text-ds-muted">Cart is empty — scan or search to add items.</p>
                )
              )}

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
                          <QuickPickButton
                            key={item.id}
                            item={item}
                            onSelect={() => void pickForCheckout({ sku: item.sku })}
                          />
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
                          <QuickPickButton
                            key={item.id}
                            item={item}
                            meta={`${item.quantity} ${item.unit}`}
                            onSelect={() => void pickForCheckout({ row: item })}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <>
              {receiveProduct ? (
                <section className="flex flex-col gap-5">
                  <ProductDetailCard
                    product={receiveProduct}
                    busy={busy}
                    onBack={() => {
                      setReceiveProduct(null);
                      setReceiveQty(1);
                    }}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    {(["receive", "issue"] as const).map((kind) => (
                      <ScannerBubbleButton
                        key={kind}
                        type="button"
                        disabled={busy}
                        onClick={() => setReceiveAction(kind)}
                        className={cn(
                          "py-5 text-lg font-bold capitalize",
                          receiveAction === kind
                            ? kind === "receive"
                              ? bubbleActiveReceive
                              : bubbleActiveIssue
                            : bubbleIdle,
                        )}
                      >
                        {kind}
                      </ScannerBubbleButton>
                    ))}
                  </div>
                  <QtyStepper
                    quantity={receiveQty}
                    onChange={setReceiveQty}
                    busy={busy}
                    max={receiveProduct.item_type === "tool" ? 1 : undefined}
                  />
                  <ScannerBubbleButton
                    type="button"
                    disabled={busy}
                    onClick={() => void submitReceive()}
                    className={cn(bubblePrimary, "w-full py-4 text-lg font-bold")}
                  >
                    {busy ? "Saving…" : "Complete transaction"}
                  </ScannerBubbleButton>
                </section>
              ) : (
                <>
                  <p className="text-center text-sm text-ds-muted">
                    Search above, then receive or issue stock for one product at a time.
                  </p>
                  {showQuickPicks && recent.length > 0 ? (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-ds-muted">
                        <Clock className="h-4 w-4" />
                        Recent
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {recent.map((item) => (
                          <QuickPickButton
                            key={item.id}
                            item={item}
                            onSelect={() => void pickForReceive({ sku: item.sku })}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {showQuickPicks && popular.length > 0 ? (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-ds-muted">
                        <TrendingUp className="h-4 w-4" />
                        Popular
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {popular.map((item) => (
                          <QuickPickButton
                            key={item.id}
                            item={item}
                            meta={`${item.quantity} ${item.unit}`}
                            onSelect={() => void pickForReceive({ row: item })}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
