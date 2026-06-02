"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { EmailRecipientMultiSelect } from "@/components/inventory/EmailRecipientMultiSelect";
import { WizardStepIntro } from "@/components/inventory/setup-wizard/InventoryWizardStepFields";
import { dsFormHintClass, dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import {
  parseEmailList,
  type InventoryNotificationsConfig,
} from "@/lib/inventory/inventory-notifications-config";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";

type Props = {
  value: InventoryNotificationsConfig;
  onChange: (next: InventoryNotificationsConfig) => void;
};

export function NotificationContactsStep({ value, onChange }: Props) {
  const [draftEmail, setDraftEmail] = useState("");

  function addEmail() {
    const parsed = parseEmailList(draftEmail);
    if (!parsed.length) return;
    const merged = parseEmailList([...value.email_directory, ...parsed]);
    const added = parsed.filter((e) => merged.includes(e));
    onChange({
      ...value,
      email_directory: merged,
      low_stock_emails: value.low_stock_enabled
        ? [...new Set([...value.low_stock_emails.filter((e) => merged.includes(e)), ...added])]
        : value.low_stock_emails.filter((e) => merged.includes(e)),
      mr_export_emails: [...new Set([...value.mr_export_emails.filter((e) => merged.includes(e)), ...added])],
    });
    setDraftEmail("");
  }

  function removeEmail(email: string) {
    const directory = value.email_directory.filter((e) => e !== email);
    onChange({
      ...value,
      email_directory: directory,
      low_stock_emails: value.low_stock_emails.filter((e) => e !== email),
      mr_export_emails: value.mr_export_emails.filter((e) => e !== email),
    });
  }

  return (
    <div className="space-y-6">
      <WizardStepIntro
        title="Notification contacts"
        description="Add team emails once, then choose who receives low-stock alerts and material request export notifications."
      />
        <div className="space-y-2">
          <label className={dsLabelClass}>Email directory</label>
          <p className={dsFormHintClass}>Comma-separated or one at a time. These addresses appear in export and alert pickers.</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              className={cn(dsInputClass, "min-w-[14rem] flex-1")}
              placeholder="name@company.com"
              value={draftEmail}
              onChange={(e) => setDraftEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addEmail();
                }
              }}
            />
            <button
              type="button"
              className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2 text-sm font-semibold")}
              onClick={addEmail}
            >
              Add
            </button>
          </div>
          {value.email_directory.length ? (
            <ul className="flex flex-wrap gap-2 pt-1">
              {value.email_directory.map((email) => (
                <li
                  key={email}
                  className="inline-flex items-center gap-1 rounded-full border border-ds-border bg-ds-secondary/50 pl-3 pr-1 py-1 text-sm font-medium text-ds-foreground"
                >
                  {email}
                  <button
                    type="button"
                    className="rounded-full p-1 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
                    aria-label={`Remove ${email}`}
                    onClick={() => removeEmail(email)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={value.low_stock_enabled}
            onChange={(e) => onChange({ ...value, low_stock_enabled: e.target.checked })}
          />
          <span className="text-sm text-ds-foreground">
            <span className="font-semibold">Send low-stock email alerts</span>
            <span className="mt-0.5 block text-ds-muted">Requires SMTP on the server and Inventory → Alerts enabled.</span>
          </span>
        </label>

        {value.low_stock_enabled ? (
          <EmailRecipientMultiSelect
            title="Low-stock notifications"
            description="Select all addresses that should receive alerts when items hit minimum quantity."
            directory={value.email_directory}
            selected={value.low_stock_emails}
            onChange={(low_stock_emails) => onChange({ ...value, low_stock_emails })}
            emptyHint="Add at least one email above to assign low-stock notifications."
          />
        ) : null}

        <EmailRecipientMultiSelect
          title="Material request export (default recipients)"
          description="Pre-selected when using Export Request. You can change recipients on each export."
          directory={value.email_directory}
          selected={value.mr_export_emails}
          onChange={(mr_export_emails) => onChange({ ...value, mr_export_emails })}
          emptyHint="Add at least one email above to set default MR export recipients."
        />
    </div>
  );
}
