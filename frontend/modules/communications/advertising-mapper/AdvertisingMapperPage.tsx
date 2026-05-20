"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { spatialWorkspaceHref } from "@/spatial-engine/workspace";

/**
 * @deprecated Arena Advertising lives in the unified spatial editor (`/drawings?workspace=advertising`).
 */
export function AdvertisingMapperPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(spatialWorkspaceHref("advertising"));
  }, [router]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-ds-muted">Opening spatial editor…</p>
    </div>
  );
}
