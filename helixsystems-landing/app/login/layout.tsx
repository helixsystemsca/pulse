import { AppLayout } from "@/components/app/AppLayout";
import { PulseThemedBackground } from "@/components/app/PulseThemedBackground";
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
    return (
      <>
        <PulseThemedBackground />
        <div className="login-shell login-shell--full flex flex-col">{children}</div>
      </>
    );
  }
  return (
    <AppLayout
      mainClassName="relative flex min-h-0 flex-1 flex-col bg-transparent"
      mainContentClassName="flex min-h-0 w-full max-w-none flex-1 flex-col px-4 py-0 sm:px-5"
    >
      <div className="login-shell login-shell--embedded flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </AppLayout>
  );
}
