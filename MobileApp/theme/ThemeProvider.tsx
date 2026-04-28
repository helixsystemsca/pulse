import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { darkTheme, lightTheme, type PulseTheme } from "./theme";

type ThemeMode = "dark" | "light";

export type ThemeContextValue = PulseTheme & {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const THEME_KEY = "pulse.theme.mode";

const ThemeContext = createContext<ThemeContextValue>({
  ...darkTheme,
  mode: "dark",
  setMode: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await SecureStore.getItemAsync(THEME_KEY);
        if (cancelled) return;
        if (raw === "light" || raw === "dark") setModeState(raw);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    void SecureStore.setItemAsync(THEME_KEY, m).catch(() => {});
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(() => {
    const base = mode === "light" ? lightTheme : darkTheme;
    return { ...base, mode, setMode, toggleMode };
  }, [mode, setMode, toggleMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

