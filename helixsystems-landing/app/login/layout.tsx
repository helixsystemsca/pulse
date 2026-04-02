import { AppLayout } from "@/components/app/AppLayout";
import { isPulseAppHost, requestHostnameFromHeaders } from "@/lib/pulse-host";
import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: { absolute: "Sign in | Pulse" },
  description: "Sign in to your Pulse operational dashboard.",
};

/** On Pulse app hosts (e.g. pulse.helixsystems.ca), skip the top bar; marketing host keeps `AppLayout`. */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  const h = headers();
  const host = requestHostnameFromHeaders((name) => h.get(name));
  if (isPulseAppHost(host)) {
    return <>{children}</>;
  }
  return <AppLayout mainClassName="bg-pulse-bg">{children}</AppLayout>;
}
