"use client";

import { PulseAuthTeardownReset } from "@/components/app/PulseAuthTeardownReset";
import { XpFeedbackProvider } from "@/components/operations/xp/XpFeedbackContext";
import { LogoutSuccessModal } from "@/components/ui/LogoutSuccessModal";
import { OrganizationThemeSync } from "./OrganizationThemeSync";
import { ThemeProvider } from "./ThemeProvider";

export function ThemeRoot({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <OrganizationThemeSync />
      <XpFeedbackProvider>
        <PulseAuthTeardownReset />
        <LogoutSuccessModal />
        {children}
      </XpFeedbackProvider>
    </ThemeProvider>
  );
}
