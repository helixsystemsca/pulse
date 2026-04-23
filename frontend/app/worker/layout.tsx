import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Worker Dashboard | Pulse" },
  description: "Public kiosk dashboard for the break room display.",
};

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  // Intentionally separate from the authenticated Pulse chrome.
  // This route must be immediately viewable on a kiosk browser.
  return <div className="min-h-screen bg-dashboard-canvas">{children}</div>;
}

