import type { Metadata } from "next";
import { AppNavbar } from "@/components/app/AppNavbar";

export const metadata: Metadata = {
  title: { absolute: "Pulse | by Helix Systems" },
  description:
    "Pulse helps you track tools, manage work, and align your team—work requests, equipment, scheduling, mobile field use, and alerts in one system.",
};

/**
 * Pulse product marketing routes: same white top bar as the app (`AppNavbar` + Activity + “Pulse”),
 * without `AppLayout` so the signed-in sidebar does not appear here.
 */
export default function PulseProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNavbar />
      {children}
    </>
  );
}
