"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmailRecipientMultiSelect } from "@/components/inventory/EmailRecipientMultiSelect";
import { PremiumModal } from "@/components/ui/premium-modal";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";
import {
  REORDER_OUTPUT_OPTIONS,
  toggleReorderOutput,
  type ReorderOutputType,
} from "@/lib/inventory/reorder-outputs-config";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
const SECONDARY_BTN = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "px-4 py-2.5 text-sm font-semibold",
);
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E] focus:outline-none focus:ring-2 focus:ring-[#2B4C7E]/20 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100";

export type ReorderPackageForm = {
  project: string;
  location: string;
  cost_object: string;
  comments: string;
  notify_emails: string[];
  outputs: ReorderOutputType[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  itemCount: number;
  busy: boolean;
  emailDirectory: string[];
  defaultNotifyEmails: string[];
  enabledOutputs: ReorderOutputType[];
  onGenerate: (form: ReorderPackageForm) => void | Promise<void>;
};

export function ReorderPackageModal({
  open,
  onClose,
  itemCount,
  busy,
  emailDirectory,
  defaultNotifyEmails,
  enabledOutputs,
  onGenerate,
}: Props) {
  const [project, setProject] = useState("");
  const [location, setLocation] = useState("");
  const [costObject, setCostObject] = useState("");
  const [comments, setComments] = useState("");
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<ReorderOutputType[]>(enabledOutputs);

  useEffect(() => {
    if (!open) return;
    setOutputs(enabledOutputs);
    setNotifyEmails(defaultNotifyEmails.filter((e) => emailDirectory.includes(e)));
  }, [open, enabledOutputs, defaultNotifyEmails, emailDirectory]);

  const outputSummary = useMemo(
    () =>
      outputs
        .map((v) => REORDER_OUTPUT_OPTIONS.find((o) => o.value === v)?.label ?? v)
        .join(", "),
    [outputs],
  );

  const includesMr = outputs.includes("material_requisition");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onGenerate({
      project: project.trim(),
      location: location.trim(),
      cost_object: costObject.trim(),
      comments: comments.trim(),
      notify_emails: notifyEmails,
      outputs,
    });
  }

  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title="Generate reorder package"
      subtitle={`${itemCount} item${itemCount === 1 ? "" : "s"} · ${outputSummary || "No outputs selected"}`}
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={SECONDARY_BTN} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="reorder-package-form"
            className={PRIMARY_BTN}
            disabled={busy || !project.trim() || !location.trim() || outputs.length === 0}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                Generating…
              </>
            ) : (
              "Generate reorder package"
            )}
          </button>
        </div>
      }
    >
      <form id="reorder-package-form" className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <p className="text-sm text-pulse-muted">
          Runs each enabled reorder output for the selected queue items. Material requisitions use the official Excel
          template; email drafts are for review only (not sent automatically).
        </p>

        <div className="space-y-2">
          <p className={LABEL}>Outputs for this package</p>
          {REORDER_OUTPUT_OPTIONS.map((opt) => {
            const checked = outputs.includes(opt.value);
            const orgEnabled = enabledOutputs.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5",
                  checked
                    ? "border-[#2B4C7E]/40 bg-[#2B4C7E]/5 dark:border-ds-accent/40 dark:bg-ds-accent/10"
                    : "border-slate-200 dark:border-ds-border",
                  !orgEnabled && "opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  disabled={busy || !orgEnabled}
                  onChange={(e) => setOutputs(toggleReorderOutput(outputs, opt.value, e.target.checked))}
                />
                <span>
                  <span className="block text-sm font-semibold text-pulse-navy dark:text-gray-100">{opt.label}</span>
                  <span className="block text-xs text-pulse-muted">{opt.description}</span>
                  {!orgEnabled ? (
                    <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-300">
                      Not enabled in inventory settings.
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>

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
              placeholder="Optional — included in email drafts"
              disabled={busy}
              rows={3}
            />
          </label>
          {includesMr ? (
            <div className="sm:col-span-2">
              <EmailRecipientMultiSelect
                title="Email spreadsheet to"
                description="Optional. Sends the material requisition Excel when SMTP is configured."
                directory={emailDirectory}
                selected={notifyEmails}
                onChange={setNotifyEmails}
                disabled={busy}
              />
            </div>
          ) : null}
        </div>
      </form>
    </PremiumModal>
  );
}
