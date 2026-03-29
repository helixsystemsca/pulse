"use client";

import { useCallback, useEffect, useState } from "react";
import { isLoggedIn } from "@/lib/pulse-session";

export function usePulseAuth() {
  const [authed, setAuthed] = useState(false);

  const refresh = useCallback(() => {
    setAuthed(isLoggedIn());
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

  return { authed, refresh };
}
