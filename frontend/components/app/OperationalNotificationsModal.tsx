"use client";

import Link from "next/link";
import { AlertTriangle, Bell, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_MODAL_PORTAL_Z_BASE } from "@/components/ui/app-modal-layer";
import { cn } from "@/lib/cn";
import { fetchOperationalNotificationsForHeader } from "@/lib/dashboard/fetch-operational-notifications";
import {
  operationalNotificationHref,
  partitionNotificationsForModal,
  type OperationalNotificationItem,
  notificationTone,
} from "@/lib/dashboard/operational-notifications";
import { useOperationalNotificationsStore } from "@/lib/dashboard/operational-notifications-store";
import { getServerNow } from "@/lib/serverTime";

function NotificationRow({
  a,
  onNavigate,
  onDismiss,
}: {
  a: OperationalNotificationItem;
  onNavigate: () => void;
  onDismiss: (id: string) => void;
}) {
  const t = notificationTone(a);
  const href = operationalNotificationHref(a);
  const shell = cn(
    "flex items-start gap-1 rounded-lg border px-2.5 py-2 text-xs transition-colors",
    t === "critical" &&
      "border-[color-mix(in_srgb,var(--ds-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)]",
    t === "warn" &&
      "border-[color-mix(in_srgb,var(--ds-warning)_38%,transparent)] bg-[color-mix(in_srgb,var(--ds-warning)_10%,transparent)]",
    t === "info" && "border-ds-border/60 bg-ds-secondary/40 dark:bg-ds-secondary/55",
  );
  const linkTone =
    t === "critical"
      ? "hover:bg-[color-mix(in_srgb,var(--ds-danger)_14%,transparent)]"
      : t === "warn"
        ? "hover:bg-[color-mix(in_srgb,var(--ds-warning)_14%,transparent)]"
        : "hover:bg-ds-secondary/70 dark:hover:bg-ds-secondary/55";
  return (
    <li>
      <div className={shell}>
        <Link
          href={href}
          className={cn(
            "flex min-w-0 flex-1 items-start gap-2 rounded-md no-underline outline-none ring-offset-2 ring-offset-ds-elevated transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)]",
            linkTone,
          )}
          onClick={onNavigate}
        >
          {t === "critical" ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ds-danger)]" aria-hidden />
          ) : (
            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ds-muted" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="font-semibold leading-snug text-ds-foreground">{a.title}</p>
            {a.subtitle ? (
              <p className="mt-0.5 whitespace-pre-line text-[11px] leading-relaxed text-ds-muted">{a.subtitle}</p>
            ) : null}
          </div>
        </Link>
        <button
          type="button"
          className="mt-0.5 shrink-0 rounded-md p-0.5 text-ds-muted transition-colors hover:bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] hover:text-ds-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ds-accent)]"
          aria-label={`Dismiss “${a.title}”`}
          onClick={() => onDismiss(a.id)}
        >
          <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </li>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function OperationalNotificationsModal({ open, onClose }: Props) {
  const storeItems = useOperationalNotificationsStore((s) => s.items);
  const setItems = useOperationalNotificationsStore((s) => s.setItems);
  const dismissItem = useOperationalNotificationsStore((s) => s.dismissItem);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const next = await fetchOperationalNotificationsForHeader();
      if (next) {
        setItems(next);
        return;
      }
      if (useOperationalNotificationsStore.getState().items.length === 0) {
        setFetchError("Sign in with a tenant account to load notifications, or open the operations dashboard.");
      }
    } catch {
      setFetchError("Could not refresh notifications.");
    } finally {
      setLoading(false);
    }
  }, [setItems]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { today, other } = useMemo(
    () => partitionNotificationsForModal(storeItems, getServerNow()),
    [storeItems],
  );

  const showToday = today.length > 0;
  const showOther = other.length > 0;
  const allEmpty = !showToday && !showOther;

  if (!open) return null;

  return (
    <div
      className={cn(APP_MODAL_PORTAL_Z_BASE, "fixed inset-0 flex items-center justify-center p-4")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="operational-notifications-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(32rem,85vh)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-ds-border bg-ds-elevated shadow-[var(--ds-shadow-diffuse)]">
        <div className="flex items-start justify-between gap-3 border-b border-ds-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="operational-notifications-title" className="text-sm font-semibold text-ds-foreground">
              Notifications
            </h2>
            <p className="mt-0.5 text-[11px] text-ds-muted">
              Today&apos;s list is newest first; anything not from today is grouped below and sorted by severity.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-ds-muted hover:bg-ds-secondary hover:text-ds-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading && storeItems.length === 0 ? (
            <p className="text-sm text-ds-muted">Loading…</p>
          ) : fetchError && storeItems.length === 0 ? (
            <p className="text-sm text-ds-muted">{fetchError}</p>
          ) : allEmpty ? (
            <p className="text-sm text-ds-muted">You&apos;re all caught up.</p>
          ) : (
            <div className="space-y-5">
              {showToday ? (
                <section aria-label="Today">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ds-muted">Today</p>
                  <ul className="mt-2 space-y-2">
                    {today.map((a) => (
                      <NotificationRow key={a.id} a={a} onNavigate={onClose} onDismiss={dismissItem} />
                    ))}
                  </ul>
                </section>
              ) : null}
              {showOther ? (
                <section
                  className={cn(showToday && "border-t border-ds-border/80 pt-4")}
                  aria-label={showToday ? "Earlier notifications" : "Notifications"}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ds-muted">
                    {showToday ? "Earlier" : "Notifications"}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {other.map((a) => (
                      <NotificationRow key={a.id} a={a} onNavigate={onClose} onDismiss={dismissItem} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ds-border px-4 py-2.5">
          <button
            type="button"
            className="text-[11px] font-semibold text-ds-muted underline-offset-2 hover:text-ds-foreground hover:underline disabled:opacity-50"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}
