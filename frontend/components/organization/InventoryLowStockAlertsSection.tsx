"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { dsFormHintClass, dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { apiFetch } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type InventoryLowStockProfile = {
  enabled: boolean;
  emails: string;
  email_list?: string[];
};

type Props = {
  /** Tighter layout when embedded in a settings modal */
  compact?: boolean;
  className?: string;
};

export function InventoryLowStockAlertsSection({ compact = false, className }: Props) {
  const enabledId = useId();
  const emailsId = useId();
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [emails, setEmails] = useState("");
  const [initialEnabled, setInitialEnabled] = useState(false);
  const [initialEmails, setInitialEmails] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const out = await apiFetch<{ inventory_low_stock?: InventoryLowStockProfile }>("/api/v1/company/profile");
      const inv = out.inventory_low_stock;
      const en = Boolean(inv?.enabled);
      const em = inv?.emails ?? (inv?.email_list?.length ? inv.email_list.join(", ") : "");
      setEnabled(en);
      setEmails(em);
      setInitialEnabled(en);
      setInitialEmails(em);
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = enabled !== initialEnabled || emails.trim() !== initialEmails.trim();

  const save = async () => {
    setErr(null);
    setOk(null);
    setSaving(true);
    try {
      await apiFetch("/api/v1/company/profile", {
        method: "PATCH",
        body: JSON.stringify({
          inventory_low_stock: { enabled, emails: emails.trim() },
        }),
      });
      setInitialEnabled(enabled);
      setInitialEmails(emails.trim());
      setOk("Low stock notification settings saved.");
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setErr(null);
    setOk(null);
    setTesting(true);
    try {
      const out = await apiFetch<{ sent: boolean; to?: string[] }>(
        "/api/v1/company/profile/inventory-low-stock/test-email",
        {
          method: "POST",
          json: { emails: emails.trim() },
        },
      );
      const to = out.to?.length ? ` to ${out.to.join(", ")}` : "";
      setOk(`Test email sent${to}.`);
    } catch (e) {
      const detail = parseClientApiError(e).message;
      setErr(
        detail
          ? detail.startsWith("Unable to send test email")
            ? detail
            : `Unable to send test email: ${detail}`
          : "Unable to send test email.",
      );
    } finally {
      setTesting(false);
    }
  };

  const body = (
    <>
      {err ? (
        <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {err}
        </p>
      ) : null}
      {ok ? (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {ok}
        </p>
      ) : null}

      <label htmlFor={enabledId} className="flex cursor-pointer items-start gap-3">
        <input
          id={enabledId}
          type="checkbox"
          className="mt-1"
          checked={enabled}
          disabled={!loaded || saving}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>
          <span className="text-sm font-semibold text-ds-foreground">Email when stock hits minimum</span>
          <span className={cn(dsFormHintClass, "mt-0.5 block")}>
            Sends one email per low-stock period (until quantity goes back above the minimum). Items are also added to
            Material requests.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor={emailsId} className={dsLabelClass}>
          Recipient emails
        </label>
        <p className={dsFormHintClass}>Comma-separated. Example: plantsup_kearl@kentplc.com, buyer@company.com</p>
        <textarea
          id={emailsId}
          rows={compact ? 3 : 4}
          className={cn(dsInputClass, "mt-2 w-full font-mono text-sm")}
          placeholder="email@company.com"
          value={emails}
          disabled={!loaded || saving}
          onChange={(e) => setEmails(e.target.value)}
        />
      </div>

      <p className={dsFormHintClass}>
        Requires outbound SMTP on the server and Inventory → Settings → Alerts → Low stock alerts enabled. Configure
        recipients here once per organization; the same settings apply on Company branding and Permissions.
      </p>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5 text-sm")}
          disabled={!loaded || saving || testing || !enabled || !emails.trim()}
          onClick={() => void sendTest()}
          title={!enabled ? "Enable low stock emails to send a test." : !emails.trim() ? "Add recipients to send a test." : "Send a test email"}
        >
          {testing ? "Sending…" : "Send test email"}
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5 text-sm")}
          disabled={!loaded || saving || !dirty}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save notifications"}
        </button>
      </div>
    </>
  );

  if (compact) {
    return <div className={cn("space-y-4", className)}>{body}</div>;
  }

  return (
    <Card variant="secondary" padding="lg" className={className}>
      <SectionHeader
        title="Inventory low stock emails"
        description="Tenant-wide recipients for below-minimum alerts (shared with Permissions → Notifications)."
      />
      <div className="mt-4 space-y-4">{body}</div>
    </Card>
  );
}
