"use client";

import { Download, Printer } from "lucide-react";
import { QrCodeImage } from "@/components/qr/QrCodeImage";
import { qrResourceTypeLabel } from "@/lib/qr/qr-resource-types";
import { qrScanUrl } from "@/lib/qr/qr-scan-url";
import type { QrResourceRow } from "@/lib/qr/qrResourceService";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";

const BTN = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm font-semibold");

type Props = {
  resource: QrResourceRow;
};

export function QrPrintSheet({ resource }: Props) {
  const scanUrl = qrScanUrl(resource.qr_url);

  function printSheet() {
    const w = window.open("", "_blank", "noopener,noreferrer,width=480,height=720");
    if (!w) return;
    w.document.write(`
      <html><head><title>QR — ${resource.name}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; text-align: center; }
        h1 { font-size: 1.25rem; margin: 0 0 8px; }
        .meta { color: #555; font-size: 0.875rem; margin-bottom: 16px; }
        img { width: 280px; height: 280px; }
      </style></head><body>
      <img src="https://quickchart.io/qr?text=${encodeURIComponent(scanUrl)}&size=280" alt="" />
      <h1>${resource.name}</h1>
      <p class="meta">${qrResourceTypeLabel(resource.resource_type)}</p>
      ${resource.description ? `<p>${resource.description}</p>` : ""}
      <p class="meta">${scanUrl}</p>
      <script>window.print();</script>
      </body></html>
    `);
    w.document.close();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-ds-border dark:bg-ds-primary">
      <QrCodeImage value={scanUrl} size={220} className="mx-auto rounded-lg border border-slate-100" />
      <h3 className="mt-4 text-lg font-bold text-pulse-navy dark:text-gray-100">{resource.name}</h3>
      <p className="text-sm text-pulse-muted">{qrResourceTypeLabel(resource.resource_type)}</p>
      {resource.description ? (
        <p className="mt-2 text-sm text-pulse-navy dark:text-gray-200">{resource.description}</p>
      ) : null}
      <p className="mt-3 break-all text-xs text-pulse-muted">{scanUrl}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" className={BTN} onClick={printSheet}>
          <Printer className="mr-2 inline h-4 w-4" aria-hidden />
          Print
        </button>
        <button
          type="button"
          className={BTN}
          disabled
          title="PDF export coming soon"
        >
          <Download className="mr-2 inline h-4 w-4" aria-hidden />
          Download PDF
        </button>
      </div>
    </div>
  );
}
