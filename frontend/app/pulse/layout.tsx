import { AppNavbar } from "@/components/app/AppNavbar";
import { isPulseAppHost, requestHostnameFromHeaders } from "@/lib/pulse-host";
import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: { absolute: "Pulse | Panorama" },
  description:
    "Pulse helps you track tools, manage work, and align your team—work requests, equipment, scheduling, mobile field use, and alerts in one system.",
};

/**
 * Pulse product marketing: top bar on the marketing host only. Pulse app host has no duplicate header.
 */
export default function PulseProductLayout({ children }: { children: React.ReactNode }) {
  const h = headers();
  const host = requestHostnameFromHeaders((name) => h.get(name));
  if (isPulseAppHost(host)) {
    return <>{children}</>;
  }
  return (
    <>
      <AppNavbar />
      {children}
    </>
  );
}
