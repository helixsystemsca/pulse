"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

export type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyLightTheme() {
  document.documentElement.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyLightTheme();
  }, []);

  const setTheme = useCallback((_t: ThemeMode) => {
    applyLightTheme();
  }, []);

  const toggleTheme = useCallback(() => {
    applyLightTheme();
  }, []);

  const value = useMemo(
    () => ({ theme: "light" as ThemeMode, setTheme, toggleTheme }),
    [setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
}
