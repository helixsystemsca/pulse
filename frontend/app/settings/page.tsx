import { Suspense } from "react";
import { SettingsApp } from "@/components/settings/SettingsApp";

export const metadata = {
  title: "Settings · Pulse",
};

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-ds-accent border-t-transparent" />
        </div>
      }
    >
      <SettingsApp />
    </Suspense>
  );
}
