"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { endPulseAuthTeardown, isPulsePublicPath } from "@/lib/pulse-session";

/**
 * After navigation to a public route (login, invite, etc.), clear the post-logout teardown flag
 * once straggling fetches have had time to finish so real errors on auth screens still show.
 */
export function PulseAuthTeardownReset() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || !isPulsePublicPath(pathname)) return;
    const id = window.setTimeout(() => endPulseAuthTeardown(), 350);
    return () => window.clearTimeout(id);
  }, [pathname]);
  return null;
}
