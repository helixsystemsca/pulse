"use client";

/**
 * Keeps `getServerNow()` aligned via `/auth/me` on load and periodic resync.
 * Also refreshes stored entitlements (`rbac_permissions`, `enabled_features`, …) when the tab
 * becomes visible or the network reconnects so Team Management changes propagate without a full reload.
 */
import { useEffect } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode, refreshPulseUserFromServer } from "@/lib/api";

const RESYNC_MS = 12 * 60 * 1000;
const VISIBILITY_RESYNC_DEBOUNCE_MS = 750;

export function ServerTimeSync() {
  const { authed } = usePulseAuth();

  useEffect(() => {
    if (!authed || !isApiMode()) return;

    let cancelled = false;
    let debounceTimer: number | null = null;

    const sync = async () => {
      try {
        await refreshPulseUserFromServer();
      } catch {
        /* refreshPulseUserFromServer swallows most errors; 401 handled inside */
      }
    };

    const scheduleVisibilitySync = () => {
      if (document.visibilityState !== "visible") return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        if (cancelled) return;
        void sync();
      }, VISIBILITY_RESYNC_DEBOUNCE_MS);
    };

    void sync();
    const id = window.setInterval(() => void sync(), RESYNC_MS);
    document.addEventListener("visibilitychange", scheduleVisibilitySync);
    window.addEventListener("online", scheduleVisibilitySync);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", scheduleVisibilitySync);
      window.removeEventListener("online", scheduleVisibilitySync);
    };
  }, [authed]);

  return null;
}
