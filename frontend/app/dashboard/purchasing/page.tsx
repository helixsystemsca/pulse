"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pulseAppHref } from "@/lib/pulse-app";

/** Purchasing lives on the Inventory page — redirect legacy route. */
export default function PurchasingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(pulseAppHref("/dashboard/inventory"));
  }, [router]);

  return (
    <p className="mx-auto max-w-6xl px-4 py-8 text-sm text-pulse-muted sm:px-6">
      Redirecting to Inventory…
    </p>
  );
}
