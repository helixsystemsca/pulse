"use client";

import Link from "next/link";
import { HelixMarketingLogo } from "@/components/branding/HelixMarketingLogo";
import { helixMarketingHref } from "@/lib/pulse-app";
import { usePulseAuth } from "@/hooks/usePulseAuth";

/** Global strip below main content: visible “Powered by” + wordmark (not shown on marketing-only pages). */
export function AppPoweredByFooter() {
  const { authed } = usePulseAuth();
  const gutter = authed ? "lg:pl-64" : "";
  return (
    <footer
      className={`mt-auto flex h-14 shrink-0 items-center border-t border-gray-200 bg-white/90 dark:border-ds-border dark:bg-ds-elevated ${gutter}`.trim()}
    >
      <div className="flex w-full items-center justify-center gap-2 px-4">
        <Link
          href={helixMarketingHref("/")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md text-xs text-gray-500 no-underline transition-opacity hover:opacity-90 dark:text-gray-400"
        >
          <span className="font-medium text-gray-600 dark:text-gray-300">Powered by</span>
          <HelixMarketingLogo variant="compact" className="opacity-90" />
        </Link>
      </div>
    </footer>
  );
}
