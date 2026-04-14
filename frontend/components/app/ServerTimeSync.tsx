"use client";

/**
 * Keeps `getServerNow()` aligned via `/auth/me` on load and periodic resync.
 */
import { useEffect } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { apiFetch, isApiMode } from "@/lib/api";
import { applyServerTimeFromUserOut } from "@/lib/serverTime";
import type { UserOut } from "@/lib/pulse-session";

const RESYNC_MS = 12 * 60 * 1000;

export function ServerTimeSync() {
  const { authed } = usePulseAuth();

  useEffect(() => {
    if (!authed || !isApiMode()) return;

    let cancelled = false;

    const sync = async () => {
      try {
        const user = await apiFetch<UserOut>("/api/v1/auth/me");
        if (!cancelled) applyServerTimeFromUserOut(user);
      } catch {
        /* 401 clears session + redirects via apiFetch; network — offset unchanged */
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
