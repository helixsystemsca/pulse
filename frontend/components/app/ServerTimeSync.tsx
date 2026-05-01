"use client";

/**
 * Keeps `getServerNow()` aligned via `/auth/me` on load and periodic resync.
 */
import { useEffect } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode, refreshPulseUserFromServer } from "@/lib/api";

const RESYNC_MS = 12 * 60 * 1000;

export function ServerTimeSync() {
  const { authed } = usePulseAuth();

  useEffect(() => {
    if (!authed || !isApiMode()) return;

    let cancelled = false;

    const sync = async () => {
      try {
        await refreshPulseUserFromServer();
      } catch {
        /* refreshPulseUserFromServer swallows most errors; 401 handled inside */
      }
    };

    void sync();
    const id = window.setInterval(() => void sync(), RESYNC_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [authed]);

  return null;
}
