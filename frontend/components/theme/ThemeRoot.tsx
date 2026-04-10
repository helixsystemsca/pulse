"use client";

import { ThemeProvider } from "./ThemeProvider";

export function ThemeRoot({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
