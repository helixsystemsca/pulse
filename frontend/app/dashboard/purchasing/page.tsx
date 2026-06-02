"use client";

import { PurchasingApp } from "@/components/purchasing/PurchasingApp";
import { usePulseAuth } from "@/hooks/usePulseAuth";

export default function PurchasingPage() {
  const { session } = usePulseAuth();
  const isSystemAdmin = Boolean(session?.is_system_admin);
  const apiCompany = isSystemAdmin ? null : session?.company_id ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PurchasingApp apiCompany={apiCompany} />
    </div>
  );
}
