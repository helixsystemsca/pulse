"use client";

/**
 * Payments & billing UI: saved cards, bank rails, invoice sidebar, add-method modal (mock PAN).
 * Company admins (+ system admin with company picker) only.
 */
import {
  Building2,
  CreditCard,
  Download,
  Landmark,
  Loader2,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInvoices, usePaymentMethods, usePaymentSummary } from "@/hooks/usePayments";
import { apiFetch } from "@/lib/api";
import {
  createPaymentMethod,
  deletePaymentMethod,
  setPrimaryPaymentMethod,
  type InvoiceRow,
  type PaymentMethodRow,
} from "@/lib/paymentsService";
import { readSession } from "@/lib/pulse-session";

type CompanyOption = { id: string; name: string };

function maskPan(last4: string): string {
  return `•••• •••• •••• ${last4}`;
}

function cardLabel(brand: string | null): string {
  const b = (brand ?? "").toLowerCase();
  if (b === "visa") return "VISA CORPORATE";
  if (b === "mastercard") return "MASTERCARD BUSINESS";
  if (b === "amex") return "AMERICAN EXPRESS";
  return "CARD";
}

function railLabel(rail: string | null): string {
  if (rail === "ach") return "ACH / Direct Deposit";
  if (rail === "wire_swift") return "SWIFT / Wire Transfer";
  return "Bank account";
}

function invoiceBadge(status: string): string {
  if (status === "paid") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80";
  if (status === "pending") return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
  return "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80";
}

function formatMoney(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(n);
}

export function PaymentsApp() {
  const session = readSession();
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const sessionCompanyId = session?.company_id ?? null;
  const [companyPick, setCompanyPick] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [filter, setFilter] = useState("");

  const effectiveCompanyId = isSystemAdmin ? companyPick : sessionCompanyId;
  const dataEnabled = Boolean(effectiveCompanyId);

  const methodsHook = usePaymentMethods(effectiveCompanyId, dataEnabled);
  const invoicesHook = useInvoices(effectiveCompanyId, dataEnabled, 40);
  const summaryHook = usePaymentSummary(effectiveCompanyId, dataEnabled);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<"card" | "bank">("card");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [holderName, setHolderName] = useState("");
  const [makePrimary, setMakePrimary] = useState(false);

  const [bankName, setBankName] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [rail, setRail] = useState<"ach" | "wire_swift">("ach");
  const [bankPrimary, setBankPrimary] = useState(false);

  useEffect(() => {
    if (!isSystemAdmin || !session?.access_token) return;
    void (async () => {
      try {
        const rows = await apiFetch<CompanyOption[]>(`/api/system/companies?include_inactive=false&q=`);
        setCompanies(rows.map((r) => ({ id: r.id, name: r.name })));
      } catch {
        setCompanies([]);
      }
    })();
  }, [isSystemAdmin, session?.access_token]);

  const resetModal = () => {
    setFormError(null);
    setCardNumber("");
    setExpiry("");
    setHolderName("");
    setMakePrimary(false);
    setBankName("");
    setAccountLast4("");
    setRail("ach");
    setBankPrimary(false);
  };

  const reloadAll = useCallback(() => {
    void methodsHook.reload();
    void invoicesHook.reload();
    void summaryHook.reload();
  }, [methodsHook, invoicesHook, summaryHook]);

  const onAdd = async () => {
    if (!effectiveCompanyId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      if (modalKind === "card") {
        await createPaymentMethod(
          {
            type: "card",
            card: {
              card_number: cardNumber,
              expiry,
              holder_name: holderName,
              is_primary: makePrimary,
            },
          },
          effectiveCompanyId,
        );
      } else {
        await createPaymentMethod(
          {
            type: "bank",
            bank: {
              bank_name: bankName,
              account_last4: accountLast4,
              rail,
              is_primary: bankPrimary,
            },
          },
          effectiveCompanyId,
        );
      }
      setModalOpen(false);
      resetModal();
      reloadAll();
    } catch {
      setFormError("Could not save payment method.");
    } finally {
      setSubmitting(false);
    }
  };

  const onRemove = async (id: string) => {
    if (!effectiveCompanyId) return;
    if (!confirm("Remove this payment method?")) return;
    try {
      await deletePaymentMethod(id, effectiveCompanyId);
      reloadAll();
    } catch {
      setFormError("Could not remove.");
    }
  };

  const onPrimary = async (id: string) => {
    if (!effectiveCompanyId) return;
    try {
      await setPrimaryPaymentMethod(id, effectiveCompanyId);
      reloadAll();
    } catch {
      setFormError("Could not update primary.");
    }
  };

  const cards = useMemo(
    () => (methodsHook.data ?? []).filter((m) => m.type === "card"),
    [methodsHook.data],
  );
  const banks = useMemo(
    () => (methodsHook.data ?? []).filter((m) => m.type === "bank"),
    [methodsHook.data],
  );

  const fq = filter.trim().toLowerCase();
  const filterMethods = (rows: PaymentMethodRow[]) =>
    !fq
      ? rows
      : rows.filter(
          (m) =>
            m.last4.includes(fq) ||
            (m.holder_name ?? "").toLowerCase().includes(fq) ||
            (m.bank_name ?? "").toLowerCase().includes(fq),
        );

  const viewAllInvoices = () => {
    const el = document.getElementById("invoice-panel");
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const exportInvoicesCsv = () => {
    const rows = invoicesHook.data?.items ?? [];
    const header = ["reference", "amount", "currency", "status", "issued_at"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          JSON.stringify(r.reference_number),
          JSON.stringify(r.amount),
          JSON.stringify(r.currency),
          r.status,
          JSON.stringify(r.issued_at),
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-pulse-muted">Industrial billing</p>
          <h1 className="mt-1 font-headline text-2xl font-bold tracking-tight text-pulse-navy sm:text-3xl">
            Payment Methods
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-pulse-muted">
            Manage your corporate billing profiles, connected cards, and bank account settings.
          </p>
        </div>
        <div className="relative w-full max-w-md lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted" />
          <input
            type="search"
            placeholder="Search methods…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-pulse-navy shadow-sm outline-none ring-pulse-accent/20 focus:ring-2"
          />
          {summaryHook.data ? (
            <p className="mt-2 text-right text-xs font-semibold text-pulse-muted">
              Region: {summaryHook.data.region_label}
            </p>
          ) : null}
        </div>
      </div>

      {isSystemAdmin ? (
        <div className="mt-6 rounded-xl border border-pulse-border bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-pulse-muted">Company</label>
          <select
            className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-pulse-navy outline-none focus:border-pulse-accent focus:ring-2 focus:ring-pulse-accent/25"
            value={companyPick ?? ""}
            onChange={(e) => setCompanyPick(e.target.value || null)}
          >
            <option value="">Select company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {formError ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {formError}
        </p>
      ) : null}

      {!dataEnabled ? (
        <p className="mt-10 text-sm text-pulse-muted">
          {isSystemAdmin ? "Select a company to manage billing." : "Sign in as a company administrator."}
        </p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_min(380px,100%)]">
          <div className="space-y-8">
            <section>
              <h2 className="text-base font-bold text-pulse-navy">Credit & debit cards</h2>
              {methodsHook.loading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-pulse-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading…
                </div>
              ) : methodsHook.error ? (
                <p className="mt-4 text-sm text-rose-600">{methodsHook.error}</p>
              ) : filterMethods(cards).length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-pulse-muted">
                  No cards on file. Add a corporate card below.
                </p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {filterMethods(cards).map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl border border-pulse-border bg-white p-4 shadow-sm ring-1 ring-slate-100/80 ${
                        m.is_primary ? "border-l-4 border-l-[#2563eb]" : "border-l-4 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-[#2563eb]">
                            <CreditCard className="h-4 w-4" aria-hidden />
                          </span>
                          {m.is_primary ? (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1e4a8a] ring-1 ring-sky-200/70">
                              Primary
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                        {cardLabel(m.brand)}
                      </p>
                      <p className="mt-1 font-mono text-lg font-bold tracking-wide text-pulse-navy">
                        {maskPan(m.last4)}
                      </p>
                      {m.expiry_month != null && m.expiry_year != null ? (
                        <p className="mt-2 text-sm text-pulse-muted">
                          Expires {String(m.expiry_month).padStart(2, "0")}/{String(m.expiry_year).slice(-2)}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
                        <button
                          type="button"
                          className="text-[#2563eb] hover:underline"
                          onClick={() => window.alert("Card edits can be added in a follow-up; remove and re-add for now.")}
                        >
                          Edit
                        </button>
                        {!m.is_primary ? (
                          <button
                            type="button"
                            className="text-pulse-navy hover:underline"
                            onClick={() => onPrimary(m.id)}
                          >
                            Set as primary
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-rose-600 hover:underline"
                          onClick={() => onRemove(m.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-base font-bold text-pulse-navy">Bank accounts</h2>
              {methodsHook.loading ? null : methodsHook.error ? null : filterMethods(banks).length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-pulse-muted">
                  No linked bank accounts.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {filterMethods(banks).map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-col gap-3 rounded-xl border border-pulse-border bg-white p-4 shadow-sm ring-1 ring-slate-100/80 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-pulse-navy ring-1 ring-slate-200/80">
                          {m.rail === "wire_swift" ? (
                            <Landmark className="h-5 w-5" aria-hidden />
                          ) : (
                            <Building2 className="h-5 w-5" aria-hidden />
                          )}
                        </span>
                        <div>
                          <p className="font-semibold text-pulse-navy">
                            {m.bank_name ?? "Bank"} •• {m.last4}
                          </p>
                          <p className="text-sm text-pulse-muted">{railLabel(m.rail)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!m.is_primary ? (
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-pulse-navy hover:bg-slate-50"
                            onClick={() => onPrimary(m.id)}
                          >
                            Set primary
                          </button>
                        ) : (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-[#1e4a8a] ring-1 ring-sky-200/60">
                            Primary
                          </span>
                        )}
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                          onClick={() => onRemove(m.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <button
              type="button"
              onClick={() => {
                resetModal();
                setModalOpen(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 py-4 text-sm font-bold text-pulse-navy transition-colors hover:border-pulse-accent hover:bg-sky-50/40"
            >
              <Plus className="h-5 w-5 text-pulse-accent" aria-hidden />
              Add payment method
            </button>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-pulse-border bg-white p-4 shadow-sm ring-1 ring-slate-100/80 border-l-4 border-l-amber-700/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-pulse-navy">Billing history</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportInvoicesCsv}
                    className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-pulse-navy hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={viewAllInvoices}
                    className="text-xs font-bold uppercase tracking-wide text-[#2563eb] hover:underline"
                  >
                    View all
                  </button>
                </div>
              </div>
              {invoicesHook.loading ? (
                <p className="mt-4 text-sm text-pulse-muted">Loading invoices…</p>
              ) : invoicesHook.error ? (
                <p className="mt-4 text-sm text-rose-600">{invoicesHook.error}</p>
              ) : !invoicesHook.data?.items.length ? (
                <p className="mt-4 text-sm text-pulse-muted">No invoices yet.</p>
              ) : (
                <ul
                  id="invoice-panel"
                  className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 text-sm"
                >
                  {invoicesHook.data.items.map((inv) => (
                    <li key={inv.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-pulse-navy">#{inv.reference_number}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${invoiceBadge(inv.status)}`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p className="mt-1 font-bold tabular-nums text-pulse-navy">
                        {formatMoney(inv.amount, inv.currency)}
                      </p>
                      <p className="text-xs text-pulse-muted">
                        {new Date(inv.issued_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-pulse-border bg-amber-50/40 p-4 shadow-sm ring-1 ring-amber-200/40">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-900/80">Next billing date</p>
              {summaryHook.loading ? (
                <p className="mt-2 text-sm text-pulse-muted">…</p>
              ) : summaryHook.data ? (
                <>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-pulse-navy">
                    {summaryHook.data.next_billing_date
                      ? new Date(summaryHook.data.next_billing_date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                  <p className="mt-1 text-sm text-pulse-muted">{summaryHook.data.billing_cycle} cycle</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-pulse-muted">—</p>
              )}
            </div>

            <div className="rounded-xl bg-gradient-to-br from-[#0f172a] to-[#1e3a5f] p-5 text-white shadow-lg ring-1 ring-slate-900/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <Shield className="h-5 w-5 text-sky-300" aria-hidden />
              </div>
              <p className="mt-4 text-sm font-bold leading-snug">Advanced payment encryption enabled</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                {summaryHook.data?.encryption_note ??
                  "Industrial grade 256-bit AES protection for all fleet transactions."}
              </p>
            </div>
          </aside>
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-pulse-border bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pay-modal-title"
          >
            <h2 id="pay-modal-title" className="font-headline text-lg font-bold text-pulse-navy">
              Add payment method
            </h2>
            <p className="mt-1 text-xs text-pulse-muted">Mock storage only — full card numbers are not retained.</p>

            <div className="mt-4 flex rounded-lg border border-slate-200 p-0.5">
              <button
                type="button"
                className={`flex-1 rounded-md py-2 text-xs font-bold ${
                  modalKind === "card" ? "bg-sky-50 text-[#1e4a8a] ring-1 ring-sky-200/70" : "text-pulse-muted"
                }`}
                onClick={() => setModalKind("card")}
              >
                Card
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md py-2 text-xs font-bold ${
                  modalKind === "bank" ? "bg-sky-50 text-[#1e4a8a] ring-1 ring-sky-200/70" : "text-pulse-muted"
                }`}
                onClick={() => setModalKind("bank")}
              >
                Bank
              </button>
            </div>

            {modalKind === "card" ? (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-pulse-navy">
                  Card number
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pulse-accent/30"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4242 4242 4242 4242"
                    autoComplete="off"
                  />
                </label>
                <label className="block text-xs font-semibold text-pulse-navy">
                  Expiry (MM/YY)
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pulse-accent/30"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="08/26"
                  />
                </label>
                <label className="block text-xs font-semibold text-pulse-navy">
                  Name on card
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pulse-accent/30"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-pulse-navy">
                  <input type="checkbox" checked={makePrimary} onChange={(e) => setMakePrimary(e.target.checked)} />
                  Set as primary
                </label>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-pulse-navy">
                  Bank name
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pulse-accent/30"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold text-pulse-navy">
                  Last 4 of account
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pulse-accent/30"
                    value={accountLast4}
                    onChange={(e) => setAccountLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                  />
                </label>
                <label className="block text-xs font-semibold text-pulse-navy">
                  Rail
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pulse-accent/30"
                    value={rail}
                    onChange={(e) => setRail(e.target.value as "ach" | "wire_swift")}
                  >
                    <option value="ach">ACH / Direct deposit</option>
                    <option value="wire_swift">SWIFT / Wire transfer</option>
                  </select>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-pulse-navy">
                  <input type="checkbox" checked={bankPrimary} onChange={(e) => setBankPrimary(e.target.checked)} />
                  Set as primary
                </label>
              </div>
            )}

            {formError ? <p className="mt-3 text-sm text-rose-600">{formError}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-pulse-navy hover:bg-slate-50"
                onClick={() => {
                  setModalOpen(false);
                  resetModal();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#1d4ed8] disabled:opacity-50"
                onClick={() => void onAdd()}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
