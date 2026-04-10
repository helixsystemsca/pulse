"use client";

/**
 * Subscribes to `localStorage` Pulse session + custom `pulse-auth-change` events
 * so layouts and nav re-render after login/logout without a full reload.
 */
import { useCallback, useEffect, useState } from "react";
import { readSession, type PulseAuthSession } from "@/lib/pulse-session";

export function usePulseAuth() {
  const [session, setSession] = useState<PulseAuthSession | null>(null);

  const refresh = useCallback(() => {
    setSession(readSession());
  }, []);

  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener("pulse-auth-change", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("pulse-auth-change", on);
      window.removeEventListener("storage", on);
    };
  }, [refresh]);

  return { authed: session !== null, session, refresh };
}
