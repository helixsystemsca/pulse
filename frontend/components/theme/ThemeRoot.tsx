"use client";

import { PulseAuthTeardownReset } from "@/components/app/PulseAuthTeardownReset";
import { LogoutSuccessModal } from "@/components/ui/LogoutSuccessModal";
import { ThemeProvider } from "./ThemeProvider";

export function ThemeRoot({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PulseAuthTeardownReset />
      <LogoutSuccessModal />
      {children}
    </ThemeProvider>
  );
}
