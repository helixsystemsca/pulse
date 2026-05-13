"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { fetchOperationalNotificationsForHeader } from "@/lib/dashboard/fetch-operational-notifications";
import {
  NO_ACTIVE_OPERATIONS_ALERTS_TITLE,
  notificationTone,
  operationalNotificationHref,
  partitionNotificationsForModal,
  type OperationalNotificationItem,
} from "@/lib/dashboard/operational-notifications";
import { useOperationalNotificationsStore } from "@/lib/dashboard/operational-notifications-store";
import { getServerNow } from "@/lib/serverTime";

function InboxListRow({
  a,
  selected,
  onSelect,
}: {
  a: OperationalNotificationItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = notificationTone(a);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2 border-b border-ds-border px-3 py-3 text-left text-sm transition-colors md:px-4",
        selected ? "bg-ds-secondary" : "hover:bg-ds-secondary/60",
        t === "critical" && "border-l-[3px] border-l-[var(--ds-danger)] pl-[calc(0.75rem-3px)] md:pl-[calc(1rem-3px)]",
      )}
    >
      {t === "critical" ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-danger)]" aria-hidden />
      ) : (
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 font-medium leading-snug text-ds-foreground">{a.title}</span>
        {a.subtitle ? (
          <span className="mt-0.5 line-clamp-1 block text-[11px] text-ds-muted">{a.subtitle}</span>
        ) : null}
      </span>
    </button>
  );
}

export function OperationalInboxPanel() {
  const storeItems = useOperationalNotificationsStore((s) => s.items);
  const setItems = useOperationalNotificationsStore((s) => s.setItems);
  const dismissItem = useOperationalNotificationsStore((s) => s.dismissItem);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        setFetchError("Sign in with a tenant account to load your inbox, or open the operations dashboard.");
      }
    } catch {
      setFetchError("Could not refresh your inbox.");
    } finally {
      setLoading(false);
    }
  }, [setItems]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const { today, other } = useMemo(
    () => partitionNotificationsForModal(storeItems, getServerNow()),
    [storeItems],
  );

  const flat = useMemo(() => [...today, ...other], [today, other]);
  const selected = useMemo(() => flat.find((a) => a.id === selectedId) ?? null, [flat, selectedId]);

  useEffect(() => {
    if (flat.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !flat.some((a) => a.id === selectedId)) {
      setSelectedId(flat[0]!.id);
    }
  }, [flat, selectedId]);

  const showToday = today.length > 0;
  const showOther = other.length > 0;
  const allEmpty = !showToday && !showOther;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[52rem] text-xs text-ds-muted">
          Operational alerts for your organization (missing tools, low stock, dashboard notices). Dismissing here also
          clears the item from the header notifications list until the next refresh.
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ds-border px-3 py-2 text-xs font-semibold text-ds-foreground transition-colors hover:bg-ds-secondary disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {fetchError && storeItems.length === 0 ? (
        <div className="rounded-lg border border-ds-border bg-ds-primary/40 px-3 py-2 text-sm text-ds-muted" role="status">
          {fetchError}
        </div>
      ) : null}

      <div className="ds-premium-panel overflow-hidden">
        {loading && storeItems.length === 0 ? (
          <p className="p-5 text-sm text-ds-muted">Loading your inbox…</p>
        ) : allEmpty ? (
          <p className="p-5 text-sm text-ds-muted">You&apos;re all caught up — no active operational alerts.</p>
        ) : (
          <div className="flex min-h-[min(70vh,520px)] flex-col md:grid md:grid-cols-[minmax(260px,36%)_1fr]">
            <aside className="max-h-[42vh] overflow-y-auto border-b border-ds-border md:max-h-none md:border-b-0 md:border-r">
              {showToday ? (
                <div>
                  <p className="sticky top-0 z-[1] border-b border-ds-border bg-ds-primary/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ds-muted md:px-4">
                    Today
                  </p>
                  <ul className="divide-y divide-ds-border">
                    {today.map((a) => (
                      <li key={a.id}>
                        <InboxListRow a={a} selected={a.id === selectedId} onSelect={() => setSelectedId(a.id)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {showOther ? (
                <div className={cn(showToday && "border-t border-ds-border")}>
                  <p className="sticky top-0 z-[1] border-b border-ds-border bg-ds-primary/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ds-muted md:px-4">
                    {showToday ? "Earlier" : "Alerts"}
                  </p>
                  <ul className="divide-y divide-ds-border">
                    {other.map((a) => (
                      <li key={a.id}>
                        <InboxListRow a={a} selected={a.id === selectedId} onSelect={() => setSelectedId(a.id)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </aside>
            <section className="flex min-h-[260px] flex-1 flex-col bg-ds-primary/30">
              {selected ? (
                <div className="flex flex-1 flex-col p-4 md:p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    {notificationTone(selected) === "critical" ? (
                      <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--ds-danger)]" aria-hidden />
                    ) : (
                      <Bell className="h-5 w-5 shrink-0 text-ds-muted" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="text-base font-semibold text-ds-foreground">{selected.title}</h3>
                      {selected.subtitle ? (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-ds-muted">{selected.subtitle}</p>
                      ) : null}
                      {selected.title === NO_ACTIVE_OPERATIONS_ALERTS_TITLE ? (
                        <p className="text-sm text-ds-muted">
                          When tools go missing, inventory runs low, or the dashboard reports an issue, it will appear
                          here and in the bell menu.
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Link
                          href={operationalNotificationHref(selected)}
                          className="inline-flex items-center rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-xs font-semibold text-ds-foreground transition-colors hover:bg-ds-secondary"
                        >
                          Open in app
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            dismissItem(selected.id);
                            setSelectedId(null);
                          }}
                          className="inline-flex items-center rounded-lg border border-ds-border px-3 py-2 text-xs font-semibold text-ds-muted transition-colors hover:bg-ds-secondary hover:text-ds-foreground"
                        >
                          Dismiss from inbox
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-ds-muted">
                  Select an item on the left to see details.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
