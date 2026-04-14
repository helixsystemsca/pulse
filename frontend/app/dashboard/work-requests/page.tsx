"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy `/dashboard/work-requests` — redirects to the unified work request hub (query preserved).
 */
function WorkRequestsRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(`/dashboard/maintenance${q ? `?${q}` : ""}`);
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
