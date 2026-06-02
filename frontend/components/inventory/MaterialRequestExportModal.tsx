"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { EmailRecipientMultiSelect } from "@/components/inventory/EmailRecipientMultiSelect";
import { PremiumModal } from "@/components/ui/premium-modal";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
const SECONDARY_BTN = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "px-4 py-2.5 text-sm font-semibold",
);
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E] focus:outline-none focus:ring-2 focus:ring-[#2B4C7E]/20 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100";

export type MaterialRequestExportForm = {
  project: string;
  location: string;
  cost_object: string;
  comments: string;
  notify_emails: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  itemCount: number;
  busy: boolean;
  emailDirectory: string[];
  defaultNotifyEmails: string[];
  onExport: (form: MaterialRequestExportForm) => void | Promise<void>;
};

export function MaterialRequestExportModal({
  open,
  onClose,
  itemCount,
  busy,
  emailDirectory,
  defaultNotifyEmails,
  onExport,
}: Props) {
  const [project, setProject] = useState("");
  const [location, setLocation] = useState("");
  const [costObject, setCostObject] = useState("");
  const [comments, setComments] = useState("");
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setNotifyEmails(defaultNotifyEmails.filter((e) => emailDirectory.includes(e)));
  }, [open, defaultNotifyEmails, emailDirectory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onExport({
      project: project.trim(),
      location: location.trim(),
      cost_object: costObject.trim(),
      comments: comments.trim(),
      notify_emails: notifyEmails,
    });
  }

  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title="Export material request"
      subtitle={`${itemCount} item${itemCount === 1 ? "" : "s"} will be written to the official Excel template.`}
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={SECONDARY_BTN} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="mr-export-form"
            className={PRIMARY_BTN}
            disabled={busy || !project.trim() || !location.trim()}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                Exporting…
              </>
            ) : (
              "Download Excel"
            )}
          </button>
        </div>
      }
    >
      <form id="mr-export-form" className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <p className="text-sm text-pulse-muted">
          MR and PO numbers, signatures, and approval fields are left blank for completion outside Pulse.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-1">
            <span className={LABEL}>Project</span>
            <input
              className={INPUT}
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="e.g. KEARL"
              required
              disabled={busy}
            />
          </label>
          <label className="block space-y-1 sm:col-span-1">
            <span className={LABEL}>Cost object</span>
            <input
              className={INPUT}
              value={costObject}
              onChange={(e) => setCostObject(e.target.value)}
              placeholder="Optional"
              disabled={busy}
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className={LABEL}>Job description / location</span>
            <input
              className={INPUT}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Office consumables"
              required
              disabled={busy}
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className={LABEL}>Comments</span>
            <textarea
              className={cn(INPUT, "min-h-[88px] resize-y")}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Optional"
              disabled={busy}
              rows={3}
            />
          </label>
          <div className="sm:col-span-2">
            <EmailRecipientMultiSelect
              title="Email spreadsheet to"
              description="Optional. Selected addresses receive the Excel file when SMTP is configured."
              directory={emailDirectory}
              selected={notifyEmails}
              onChange={setNotifyEmails}
              disabled={busy}
            />
          </div>
        </div>
      </form>
    </PremiumModal>
  );
}
