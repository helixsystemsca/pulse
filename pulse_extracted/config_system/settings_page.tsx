"use client";

/**
 * frontend/app/settings/page.tsx
 * ════════════════════════════════════════════════════════════════════════════
 * Dedicated settings page. All module config in one place.
 * Deep-link to a tab with: /settings?tab=schedule
 * Each module page gear icon links here with ?tab=<module>.
 *
 * Drop at: frontend/app/settings/page.tsx
 */

import { SettingsApp } from "@/components/settings/SettingsApp";

export const metadata = {
  title: "Settings · Pulse",
};

export default function SettingsPage() {
  return <SettingsApp />;
}
