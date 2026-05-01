"use client";

import { useCallback, useEffect, useState } from "react";

export const DRAWINGS_ACTIVE_PROJECT_STORAGE_KEY = "helix.drawings.activeProjectId";

export function useActiveProject(): {
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
} {
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAWINGS_ACTIVE_PROJECT_STORAGE_KEY);
      setActiveProjectIdState(raw?.trim() ? raw.trim() : null);
    } catch {
      setActiveProjectIdState(null);
    }
  }, []);

  const setActiveProjectId = useCallback((id: string | null) => {
    const next = id?.trim() ? id.trim() : null;
    setActiveProjectIdState(next);
    try {
      if (next) window.localStorage.setItem(DRAWINGS_ACTIVE_PROJECT_STORAGE_KEY, next);
      else window.localStorage.removeItem(DRAWINGS_ACTIVE_PROJECT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { activeProjectId, setActiveProjectId };
}
