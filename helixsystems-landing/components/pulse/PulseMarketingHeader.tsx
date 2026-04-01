import Link from "next/link";
import { PulseLogo } from "@/components/brand/PulseLogo";
import { pulseRoutes } from "@/lib/pulse-app";

export function PulseMarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f172a]/90 shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <Link
          href={pulseRoutes.pulseLanding}
          className="no-underline transition-opacity hover:opacity-90"
          aria-label="Pulse home"
        >
          <PulseLogo variant="dark" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={pulseRoutes.login}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/15 sm:px-4"
          >
            Sign in
          </Link>
          <Link
            href={pulseRoutes.login}
            className="rounded-lg bg-pulse-accent px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-pulse-accent-hover sm:px-4"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
