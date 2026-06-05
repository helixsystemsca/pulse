"use client";

import { QrCode } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { QrResourceWizard } from "@/components/qr/QrResourceWizard";
import { usePermissions } from "@/hooks/usePermissions";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import type { QrResourceType } from "@/lib/qr/qr-resource-types";
import { fetchQrResources } from "@/lib/qr/qrResourceService";
import { pulseAppHref } from "@/lib/pulse-app";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";

const BTN = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm font-semibold");

type Props = {
  resourceType: QrResourceType;
  resourceId: string;
  defaultName?: string;
};

export function QrResourceActions({ resourceType, resourceId, defaultName }: Props) {
  const { session } = usePulseAuth();
  const { can } = usePermissions();
  const apiCompany = session?.company_id ?? null;
  const canManage = can("qr_codes.manage");
  const canView = can("qr_codes.view") || canManage;

  const [linked, setLinked] = useState<{ id: string; qr_token: string } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (!canView || !apiCompany) return;
    void fetchQrResources(apiCompany, { resource_type: resourceType }).then((rows) => {
      const match = rows.find((r) => r.resource_id === resourceId);
      setLinked(match ? { id: match.id, qr_token: match.qr_token } : null);
    });
  }, [apiCompany, canView, resourceId, resourceType]);

  if (!canView) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {linked ? (
        <Link href={pulseAppHref(`/qr/${linked.qr_token}`)} className={BTN}>
          <QrCode className="mr-1.5 inline h-4 w-4" aria-hidden />
          Open QR
        </Link>
      ) : null}
      {canManage ? (
        <button type="button" className={BTN} onClick={() => setWizardOpen(true)}>
          <QrCode className="mr-1.5 inline h-4 w-4" aria-hidden />
          {linked ? "Manage QR" : "Generate QR code"}
        </button>
      ) : null}
      <Link
        href={pulseAppHref("/dashboard/inventory?tab=qr_codes")}
        className="text-xs font-semibold text-[#2B4C7E] hover:underline"
      >
        All QR codes
      </Link>
      {canManage ? (
        <QrResourceWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          apiCompany={apiCompany}
          initialResourceType={resourceType}
          initialResourceId={resourceId}
          initialName={defaultName}
          onSaved={(row) => setLinked({ id: row.id, qr_token: row.qr_token })}
        />
      ) : null}
    </div>
  );
}
