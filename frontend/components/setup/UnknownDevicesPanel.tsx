"use client";

/**
 * UnknownDevicesPanel
 *
 * Shows BLE MACs that were seen by a gateway but never registered.
 * Sits in the Devices tab of SetupApp, above the "Register tag" form.
 *
 * What it does:
 *  - Fetches /api/v1/ble-devices/unknown on mount and every 30s
 *  - Shows each discovered MAC with: last seen time, seen count, first seen date
 *  - "Register" button pre-fills the parent's tag registration form with the MAC
 *  - "Dismiss" button removes the MAC from the discovery list
 *  - Collapses when empty (renders nothing)
 *
 * Props:
 *  companyId        — pass effectiveCompanyId from SetupApp (null for non-admin)
 *  onRegister       — called with the MAC when operator clicks Register;
 *                     parent should pre-fill bleMac state and scroll to form
 *  isSystemAdmin    — whether to append company_id query param
 */

import { Bluetooth, ChevronDown, ChevronUp, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

// ── Types ────────────────────────────────────────────────────────────────────

export type UnknownDeviceRow = {
  id: string;
  mac_address: string;
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
};

type Props = {
  companyId: string | null;
  isSystemAdmin: boolean;
  /** Called when the operator clicks "Register" on a discovered MAC. */
  onRegister: (mac: string) => void;
  /** Poll interval in ms. Default: 30000 */
  pollMs?: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function withCompany(path: string, companyId: string | null, isAdmin: boolean): string {
  if (!isAdmin || !companyId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}company_id=${encodeURIComponent(companyId)}`;
}

async function fetchUnknownDevices(
  companyId: string | null,
  isAdmin: boolean,
): Promise<UnknownDeviceRow[]> {
  const url = withCompany("/api/v1/ble-devices/unknown", companyId, isAdmin);
  return apiFetch<UnknownDeviceRow[]>(url);
}

async function dismissUnknownDevice(
  mac: string,
  companyId: string | null,
  isAdmin: boolean,
): Promise<void> {
  const url = withCompany(
    `/api/v1/ble-devices/unknown/${encodeURIComponent(mac)}`,
    companyId,
    isAdmin,
  );
  await apiFetch<void>(url, { method: "DELETE" });
}

function seenCountLabel(n: number): string {
  if (n === 1) return "Seen once";
  if (n < 10) return `Seen ${n}×`;
  if (n < 100) return `Seen ${n}× — active`;
  return `Seen ${n}× — very active`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function UnknownDevicesPanel({
  companyId,
  isSystemAdmin,
  onRegister,
  pollMs = 30_000,
}: Props) {
  const [devices, setDevices] = useState<UnknownDeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      try {
        const rows = await fetchUnknownDevices(companyId, isSystemAdmin);
        if (mountedRef.current) {
          setDevices(rows);
          setError(null);
        }
      } catch {
        if (mountedRef.current) setError("Could not load discovered devices.");
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [companyId, isSystemAdmin],
  );

  // Initial load + poll
  useEffect(() => {
    mountedRef.current = true;
    void load();
    const id = window.setInterval(() => void load(), pollMs);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, [load, pollMs]);

  const handleDismiss = useCallback(
    async (mac: string) => {
      setDismissing((s) => new Set(s).add(mac));
      try {
        await dismissUnknownDevice(mac, companyId, isSystemAdmin);
        if (mountedRef.current) {
          setDevices((prev) => prev.filter((d) => d.mac_address !== mac));
        }
      } catch {
        // Silently ignore — the MAC will re-appear on next poll if still being seen
      } finally {
        if (mountedRef.current) {
          setDismissing((s) => {
            const next = new Set(s);
            next.delete(mac);
            return next;
          });
        }
      }
    },
    [companyId, isSystemAdmin],
  );

  // Render nothing when empty and not loading
  if (!loading && devices.length === 0 && !error) return null;

  return (
    <div className="rounded-md border border-blue-200/80 bg-blue-50/40 p-4 ring-1 ring-blue-200/50 dark:border-blue-500/25 dark:bg-blue-950/30 dark:ring-blue-500/15 md:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bluetooth className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-blue-950 dark:text-blue-100">
              Discovered · Not Registered
            </h3>
            <p className="mt-0.5 text-xs text-blue-900/75 dark:text-blue-200/70">
              These MACs were heard by a gateway but aren't registered yet. Register them here or
              dismiss if they're not your beacons.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Count badge */}
          {devices.length > 0 && (
            <span className="rounded-full bg-blue-200/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-950 dark:bg-blue-800/60 dark:text-blue-100">
              {devices.length} discovered
            </span>
          )}

          {/* Refresh */}
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-blue-200/70 bg-white/70 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-900/30 dark:text-blue-200"
            title="Refresh"
          >
            <RefreshCw
              className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden
            />
            Refresh
          </button>

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex items-center rounded-md border border-blue-200/70 bg-white/70 p-1.5 text-blue-800 hover:bg-blue-50 dark:border-blue-500/30 dark:bg-blue-900/30 dark:text-blue-200"
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-blue-800/70 dark:text-blue-300/70">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              Scanning for discovered devices…
            </div>
          ) : error ? (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          ) : (
            <ul className="space-y-2">
              {devices.map((d) => (
                <UnknownDeviceRow
                  key={d.mac_address}
                  device={d}
                  isDismissing={dismissing.has(d.mac_address)}
                  onRegister={() => onRegister(d.mac_address)}
                  onDismiss={() => void handleDismiss(d.mac_address)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Row sub-component ─────────────────────────────────────────────────────────

function UnknownDeviceRow({
  device,
  isDismissing,
  onRegister,
  onDismiss,
}: {
  device: UnknownDeviceRow;
  isDismissing: boolean;
  onRegister: () => void;
  onDismiss: () => void;
}) {
  const lastSeen = formatRelativeTime(device.last_seen_at);
  const firstSeen = new Date(device.first_seen_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <li className="flex flex-col gap-3 rounded-md border border-blue-200/60 bg-white/70 p-3 dark:border-blue-500/20 dark:bg-blue-900/20 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: MAC + metadata */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-ds-foreground">
            {device.mac_address}
          </span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-800 dark:bg-blue-800/40 dark:text-blue-200">
            {seenCountLabel(device.seen_count)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-ds-muted">
          Last seen {lastSeen} · First detected {firstSeen}
        </p>
      </div>

      {/* Right: actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRegister}
          className="rounded-md bg-ds-accent px-3 py-1.5 text-xs font-semibold text-ds-accent-foreground shadow-[var(--ds-shadow-card)] hover:bg-ds-accent/90"
        >
          Register
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={isDismissing}
          className="inline-flex items-center gap-1 rounded-md border border-ds-border bg-ds-primary px-3 py-1.5 text-xs font-semibold text-ds-muted shadow-[var(--ds-shadow-card)] hover:bg-ds-interactive-hover hover:text-ds-foreground disabled:opacity-50"
          title="Dismiss — removes from this list. Will re-appear if the gateway hears it again."
        >
          {isDismissing ? (
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-ds-muted border-t-transparent" />
          ) : (
            <X className="h-3 w-3" aria-hidden />
          )}
          Dismiss
        </button>
      </div>
    </li>
  );
}
