"use client";

import { Check, ClipboardCopy, Download, Printer } from "lucide-react";
import { useState } from "react";
import { PremiumModal } from "@/components/ui/premium-modal";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";
import type { ReorderPackageResult } from "@/lib/inventoryMaterialRequestsService";

const SECONDARY_BTN = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "px-3 py-2 text-sm font-semibold",
);

type ShoppingListVendorGroup = {
  vendor: string;
  items: { item_name: string; sku: string; reorder_qty: number; display: string }[];
};

type EmailDraft = { vendor: string; subject: string; body: string };

type Props = {
  open: boolean;
  onClose: () => void;
  packageResult: ReorderPackageResult | null;
};

function downloadBase64File(base64: string, fileName: string, mediaType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mediaType });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(href);
}

function downloadTextFile(text: string, fileName: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(href);
}

export function ReorderPackageResultsModal({ open, onClose, packageResult }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copyText(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }

  const outputs = packageResult?.outputs.filter((o) => o.success) ?? [];
  const mrOutput = outputs.find((o) => o.output_type === "material_requisition");
  const emailOutput = outputs.find((o) => o.output_type === "email_draft");
  const shoppingOutput = outputs.find((o) => o.output_type === "shopping_list");

  const emailDrafts = (emailOutput?.data.drafts as EmailDraft[] | undefined) ?? [];
  const shoppingGroups = (shoppingOutput?.data.vendor_groups as ShoppingListVendorGroup[] | undefined) ?? [];
  const shoppingText = String(shoppingOutput?.data.plain_text ?? "");

  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title="Generated outputs"
      subtitle={
        packageResult
          ? `${packageResult.item_count} item${packageResult.item_count === 1 ? "" : "s"} · ${packageResult.project}`
          : undefined
      }
      size="lg"
      footer={
        <div className="flex justify-end">
          <button type="button" className={SECONDARY_BTN} onClick={onClose}>
            Done
          </button>
        </div>
      }
    >
      {!packageResult ? (
        <p className="text-sm text-pulse-muted">No package generated.</p>
      ) : (
        <div className="space-y-6">
          <ul className="space-y-2">
            {outputs.map((output) => (
              <li
                key={output.output_type}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-ds-border dark:bg-ds-secondary/40"
              >
                <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span className="font-semibold text-pulse-navy dark:text-gray-100">{output.label}</span>
                {output.detail ? <span className="text-pulse-muted">· {output.detail}</span> : null}
              </li>
            ))}
          </ul>

          {mrOutput?.data.file_base64 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">Material requisition</p>
              <button
                type="button"
                className={SECONDARY_BTN}
                onClick={() =>
                  downloadBase64File(
                    String(mrOutput.data.file_base64),
                    String(mrOutput.data.file_name ?? "MR-export.xlsx"),
                    String(mrOutput.data.media_type ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                  )
                }
              >
                <Download className="mr-2 inline h-4 w-4" aria-hidden />
                Download Excel
              </button>
            </div>
          ) : null}

          {emailDrafts.length ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">Email drafts</p>
              {emailDrafts.map((draft) => {
                const key = `email-${draft.vendor}`;
                const full = `Subject: ${draft.subject}\n\n${draft.body}`;
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-slate-200 bg-white p-4 dark:border-ds-border dark:bg-ds-primary"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-pulse-navy dark:text-gray-100">{draft.vendor}</p>
                      <button
                        type="button"
                        className={SECONDARY_BTN}
                        onClick={() => void copyText(key, full)}
                      >
                        {copiedKey === key ? (
                          <>
                            <Check className="mr-2 inline h-4 w-4" aria-hidden />
                            Copied
                          </>
                        ) : (
                          <>
                            <ClipboardCopy className="mr-2 inline h-4 w-4" aria-hidden />
                            Copy draft
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                      {draft.subject}
                    </p>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-sm text-pulse-navy dark:text-gray-200">
                      {draft.body}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : null}

          {shoppingGroups.length ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">Shopping list</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={SECONDARY_BTN}
                    onClick={() => downloadTextFile(shoppingText, "shopping-list.txt")}
                  >
                    <Download className="mr-2 inline h-4 w-4" aria-hidden />
                    Download
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BTN}
                    onClick={() => {
                      const w = window.open("", "_blank", "noopener,noreferrer,width=480,height=720");
                      if (!w) return;
                      const lines = shoppingGroups
                        .map((g) => {
                          const header =
                            g.vendor === "Unassigned Vendor" ? "" : `<h3>Vendor: ${g.vendor}</h3>`;
                          const items = g.items.map((i) => `<p>☐ ${i.display}</p>`).join("");
                          return `${header}${items}`;
                        })
                        .join("");
                      w.document.write(
                        `<html><head><title>Shopping List</title></head><body><h1>SHOPPING LIST</h1>${lines}<script>window.print();</script></body></html>`,
                      );
                      w.document.close();
                    }}
                  >
                    <Printer className="mr-2 inline h-4 w-4" aria-hidden />
                    Print
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-ds-border dark:bg-ds-primary">
                <p className="text-lg font-bold text-pulse-navy dark:text-gray-100">SHOPPING LIST</p>
                {shoppingGroups.map((group) => (
                  <div key={group.vendor} className="mt-4">
                    {group.vendor !== "Unassigned Vendor" ? (
                      <p className="font-semibold text-pulse-navy dark:text-gray-200">Vendor: {group.vendor}</p>
                    ) : null}
                    <ul className="mt-1 space-y-1 text-sm text-pulse-navy dark:text-gray-200">
                      {group.items.map((item) => (
                        <li key={`${group.vendor}-${item.item_name}`}>☐ {item.display}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </PremiumModal>
  );
}
