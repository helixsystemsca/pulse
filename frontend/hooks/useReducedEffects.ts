"use client";

import { useCallback, useSyncExternalStore } from "react";

export const REDUCED_EFFECTS_STORAGE_KEY = "pulse.reduced-effects";
export const REDUCED_EFFECTS_CHANGED_EVENT = "pulse-reduced-effects-changed";

function getServerSnapshot() {
  return false;
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const userExtra = window.localStorage.getItem(REDUCED_EFFECTS_STORAGE_KEY) === "1";
  const system = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return userExtra || system;
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMq = () => onStoreChange();
  mq.addEventListener("change", onMq);
  const onStorage = (e: StorageEvent) => {
    if (e.key === REDUCED_EFFECTS_STORAGE_KEY || e.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  const onCustom = () => onStoreChange();
  window.addEventListener(REDUCED_EFFECTS_CHANGED_EVENT, onCustom);
  return () => {
    mq.removeEventListener("change", onMq);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(REDUCED_EFFECTS_CHANGED_EVENT, onCustom);
  };
}

/** True when user opted into extra reduction or the OS prefers reduced motion. */
export function useReducedEffects() {
  const reduced = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setUserReducedEffects = useCallback((enabled: boolean) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(REDUCED_EFFECTS_STORAGE_KEY, enabled ? "1" : "0");
    window.dispatchEvent(new Event(REDUCED_EFFECTS_CHANGED_EVENT));
  }, []);

  return { reduced, setUserReducedEffects };
}
