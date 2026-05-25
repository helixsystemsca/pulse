"use client";

/**
 * Subscribes to `localStorage` Pulse session + custom `pulse-auth-change` events
 * so layouts and nav re-render after login/logout without a full reload.
 */
import { useCallback, useEffect, useState } from "react";
import { logAuthHookRefresh } from "@/lib/pulse-auth-lifecycle";
import { readSession, type PulseAuthSession } from "@/lib/pulse-session";

export function usePulseAuth() {
  const [session, setSession] = useState<PulseAuthSession | null>(null);

  const refresh = useCallback((source: "mount" | "pulse-auth-change" | "storage" = "mount") => {
    logAuthHookRefresh(source);
    setSession(readSession());
  }, []);

  useEffect(() => {
    refresh("mount");
    const onAuthChange = () => refresh("pulse-auth-change");
    const onStorage = () => refresh("storage");
    window.addEventListener("pulse-auth-change", onAuthChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pulse-auth-change", onAuthChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  return { authed: session !== null, session, refresh };
}
