"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  MaterialRequestExportFormFields,
  type MaterialRequestHeaderValues,
} from "@/components/inventory/MaterialRequestExportFormFields";
import { useMaterialRequestTemplateForm } from "@/components/inventory/useMaterialRequestTemplateForm";
import { EmailRecipientMultiSelect } from "@/components/inventory/EmailRecipientMultiSelect";
import { PremiumModal } from "@/components/ui/premium-modal";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");
const SECONDARY_BTN = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "px-4 py-2.5 text-sm font-semibold",
);

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
  const { fields: templateFields, loading: templateLoading } = useMaterialRequestTemplateForm(open);

  const headerValues: MaterialRequestHeaderValues = {
    project,
    location,
    cost_object: costObject,
    comments,
  };

  function setHeaderValue(key: keyof MaterialRequestHeaderValues, value: string) {
    switch (key) {
      case "project":
        setProject(value);
        break;
      case "location":
        setLocation(value);
        break;
      case "cost_object":
        setCostObject(value);
        break;
      case "comments":
        setComments(value);
        break;
      default:
        break;
    }
  }

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
          MR and PO numbers, Site Manager / Client Approval signatures, and approval fields are left blank for
          completion outside Helix. Your profile full name is written in the Requester field when set.
        </p>
        <MaterialRequestExportFormFields
          fields={templateFields}
          values={headerValues}
          onChange={setHeaderValue}
          busy={busy}
          loading={templateLoading}
        />
        <EmailRecipientMultiSelect
          title="Email spreadsheet to"
          description="Optional. Selected addresses receive the Excel file when SMTP is configured."
          directory={emailDirectory}
          selected={notifyEmails}
          onChange={setNotifyEmails}
          disabled={busy}
        />
      </form>
    </PremiumModal>
  );
}
