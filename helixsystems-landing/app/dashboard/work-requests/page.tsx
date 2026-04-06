"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy `/dashboard/work-requests` — maintenance intake and deep links live under
 * `/dashboard/maintenance/work-requests` (query string preserved).
 */
function WorkRequestsRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(`/dashboard/maintenance/work-requests${q ? `?${q}` : ""}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-pulse-muted">Redirecting…</p>
    </div>
  );
}

export default function WorkRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-pulse-muted">Loading…</p>
        </div>
      }
    >
      <WorkRequestsRedirectInner />
    </Suspense>
  );
}
