import React, { createContext, useContext, type ReactNode } from "react";
import { theme, type PulseTheme } from "./theme";

const ThemeContext = createContext<PulseTheme>(theme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): PulseTheme {
  return useContext(ThemeContext);
}

