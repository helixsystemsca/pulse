"use client";

import { PulseAuthTeardownReset } from "@/components/app/PulseAuthTeardownReset";
import { ThemeProvider } from "./ThemeProvider";

export function ThemeRoot({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PulseAuthTeardownReset />
      {children}
    </ThemeProvider>
  );
}
