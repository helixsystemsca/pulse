"use client";

import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Legacy `/operations` URL; tenant nav now uses `/monitoring`. */
export default function OperationsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const s = readSession();
    if (!s) {
      navigateToPulseLogin();
      return;
    }
    if (isApiMode() && !s.access_token) {
      navigateToPulseLogin();
      return;
    }
    router.replace("/monitoring");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-pulse-muted">Loading…</p>
    </div>
  );
}
