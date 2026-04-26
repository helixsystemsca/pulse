/**
 * Dedicated settings page. All module config in one place.
 * Deep-link: /settings?tab=schedule
 */

import { SettingsApp } from "@/components/settings/SettingsApp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings · Pulse",
};

export default function SettingsPage() {
  return <SettingsApp />;
}
