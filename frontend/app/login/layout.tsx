import { AppLayout } from "@/components/app/AppLayout";
import { isPulseAppHost, requestHostnameFromHeaders } from "@/lib/pulse-host";
import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Panorama operational dashboard.",
};

/** On app hosts (panorama / pulse subdomain), skip marketing `AppLayout`; apex/www marketing keeps chrome + footer. */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  const h = headers();
  const host = requestHostnameFromHeaders((name) => h.get(name));
  if (isPulseAppHost(host)) {
    return <div className="login-shell login-shell--full flex flex-col">{children}</div>;
  }
  return (
    <AppLayout
      pageShell={false}
      mainClassName="relative flex min-h-0 flex-1 flex-col bg-transparent"
      mainContentClassName="flex min-h-0 w-full flex-1 flex-col !px-4 sm:!px-5 !py-0"
    >
      <div className="login-shell login-shell--embedded flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </AppLayout>
  );
}
