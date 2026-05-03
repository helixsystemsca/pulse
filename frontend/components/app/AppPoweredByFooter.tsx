"use client";

import Link from "next/link";
import { HelixMarketingLogo } from "@/components/branding/HelixMarketingLogo";
import { helixMarketingHref } from "@/lib/pulse-app";
/** Global strip below main content: visible “Powered by” + wordmark (not shown on marketing-only pages). */
export function AppPoweredByFooter() {
  return (
    <footer
      className="flex h-10 w-full items-center justify-center border-t border-ds-border bg-ds-primary px-4 text-xs text-muted-foreground"
    >
      <div className="flex w-full items-center justify-center gap-2">
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
