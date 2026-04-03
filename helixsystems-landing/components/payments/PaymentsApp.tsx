"use client";

/**
 * Billing (system-admin dark theme): create invoices, record payment, saved methods (mock PAN).
 */
import {
  Building2,
  CreditCard,
  Download,
  FileText,
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
  createInvoice,
  createPaymentMethod,
  deletePaymentMethod,
  recordInvoicePayment,
  setPrimaryPaymentMethod,
  type InvoiceRow,
  type PaymentMethodRow,
} from "@/lib/paymentsService";
import { readSession } from "@/lib/pulse-session";

type CompanyOption = { id: string; name: string };

const PANEL = "rounded-xl border border-zinc-800 bg-zinc-950/80 p-5";
const INPUT =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const BTN_PRIMARY = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50";
const BTN_SECONDARY =
  "rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800";
const BTN_DANGER = "rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/70";
const BTN_GHOST = "text-xs font-semibold text-blue-400 hover:underline";

function maskPan(last4: string): string {
  return `•••• •••• •••• ${last4}`;
}

function cardLabel(brand: string | null): string {
  const b = (brand ?? "").toLowerCase();
  if (b === "visa") return "Visa";
  if (b === "mastercard") return "Mastercard";
  if (b === "amex") return "Amex";
  return "Card";
}

function railLabel(rail: string | null): string {
  if (rail === "ach") return "ACH";
  if (rail === "wire_swift") return "Wire / SWIFT";
  return "Bank";
}

function invoiceBadge(status: string): string {
  if (status === "paid") return "bg-emerald-950/60 text-emerald-300 ring-1 ring-emerald-800";
  if (status === "pending") return "bg-amber-950/50 text-amber-200 ring-1 ring-amber-800";
  return "bg-rose-950/50 text-rose-300 ring-1 ring-rose-900";
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
  const [methodFilter, setMethodFilter] = useState("");

  const effectiveCompanyId = isSystemAdmin ? companyPick : sessionCompanyId;
  const dataEnabled = Boolean(effectiveCompanyId);

  const methodsHook = usePaymentMethods(effectiveCompanyId, dataEnabled);
  const invoicesHook = useInvoices(effectiveCompanyId, dataEnabled, 40);
  const summaryHook = usePaymentSummary(effectiveCompanyId, dataEnabled);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<"card" | "bank">("card");
  const [submitting, setSubmitting] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [invAmount, setInvAmount] = useState("");
  const [invCurrency, setInvCurrency] = useState("USD");
  const [invRef, setInvRef] = useState("");

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

  const onCreateInvoice = async () => {
    if (!effectiveCompanyId) return;
    const amt = Number(invAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFormError("Enter a valid amount greater than zero.");
      return;
    }
    setInvoiceSubmitting(true);
    setFormError(null);
    try {
      await createInvoice(
        { amount: amt, currency: invCurrency || "USD", reference_number: invRef.trim() || null },
        effectiveCompanyId,
      );
      setInvAmount("");
      setInvRef("");
      reloadAll();
    } catch {
      setFormError("Could not create invoice.");
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const onRecordPayment = async (invoiceId: string) => {
    if (!effectiveCompanyId) return;
    setPayingId(invoiceId);
    setFormError(null);
    try {
      await recordInvoicePayment(invoiceId, effectiveCompanyId);
      reloadAll();
    } catch {
      setFormError("Could not record payment.");
    } finally {
      setPayingId(null);
    }
  };

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

  const fq = methodFilter.trim().toLowerCase();
  const filterMethods = (rows: PaymentMethodRow[]) =>
    !fq
      ? rows
      : rows.filter(
          (m) =>
            m.last4.includes(fq) ||
            (m.holder_name ?? "").toLowerCase().includes(fq) ||
            (m.bank_name ?? "").toLowerCase().includes(fq),
        );

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
    <div className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Billing</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Invoice &amp; payment</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Create invoices for your services, mark them paid when you receive funds, and keep customer payment methods on
            file (mock storage).
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder="Search saved methods…"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-10 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {isSystemAdmin ? (
        <div className={`mt-6 ${PANEL}`}>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Company to bill</label>
          <select
            className={`${INPUT} mt-2 max-w-md`}
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
        <p className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{formError}</p>
      ) : null}

      {!dataEnabled ? (
        <p className="mt-10 text-sm text-zinc-500">
          {isSystemAdmin ? "Select a company to create invoices and record payments." : "Sign in as a company administrator."}
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Create invoice */}
          <section className={PANEL}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-950/80 text-blue-400 ring-1 ring-blue-900">
                <FileText className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-white">Create invoice</h2>
                <p className="mt-1 text-sm text-zinc-500">Issue a pending invoice the customer can pay against.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-zinc-400" htmlFor="inv-ref">
                      Reference / service description
                    </label>
                    <input
                      id="inv-ref"
                      className={INPUT}
                      value={invRef}
                      onChange={(e) => setInvRef(e.target.value)}
                      placeholder="e.g. Pulse Pro — March 2026"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400" htmlFor="inv-amt">
                      Amount
                    </label>
                    <input
                      id="inv-amt"
                      className={INPUT}
                      inputMode="decimal"
                      value={invAmount}
                      onChange={(e) => setInvAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400" htmlFor="inv-ccy">
                      Currency
                    </label>
                    <input
                      id="inv-ccy"
                      className={INPUT}
                      value={invCurrency}
                      onChange={(e) => setInvCurrency(e.target.value.toUpperCase().slice(0, 8))}
                      placeholder="USD"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    className={BTN_PRIMARY}
                    disabled={invoiceSubmitting}
                    onClick={() => void onCreateInvoice()}
                  >
                    {invoiceSubmitting ? (
                      <>
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      "Create pending invoice"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div className="space-y-8">
              <section className={PANEL}>
                <h2 className="text-base font-semibold text-white">Invoices</h2>
                <p className="mt-1 text-sm text-zinc-500">Pending rows can be marked paid when you collect.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={exportInvoicesCsv} className={`${BTN_SECONDARY} inline-flex items-center gap-1 text-xs`}>
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </button>
                </div>
                {invoicesHook.loading ? (
                  <p className="mt-4 text-sm text-zinc-500">Loading…</p>
                ) : invoicesHook.error ? (
                  <p className="mt-4 text-sm text-red-400">{invoicesHook.error}</p>
                ) : !invoicesHook.data?.items.length ? (
                  <p className="mt-4 text-sm text-zinc-500">No invoices yet.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {invoicesHook.data.items.map((inv: InvoiceRow) => (
                      <li
                        key={inv.id}
                        className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-semibold text-white">#{inv.reference_number}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${invoiceBadge(inv.status)}`}>
                              {inv.status}
                            </span>
                          </div>
                          <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">{formatMoney(inv.amount, inv.currency)}</p>
                          <p className="text-xs text-zinc-500">
                            Issued{" "}
                            {new Date(inv.issued_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            {inv.paid_at
                              ? ` · Paid ${new Date(inv.paid_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                              : null}
                          </p>
                        </div>
                        {inv.status === "pending" ? (
                          <button
                            type="button"
                            className={`${BTN_PRIMARY} shrink-0 text-xs`}
                            disabled={payingId === inv.id}
                            onClick={() => void onRecordPayment(inv.id)}
                          >
                            {payingId === inv.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Record payment received"
                            )}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-base font-semibold text-white">Cards</h2>
                {methodsHook.loading ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : methodsHook.error ? (
                  <p className="mt-4 text-sm text-red-400">{methodsHook.error}</p>
                ) : filterMethods(cards).length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/50 p-6 text-sm text-zinc-500">
                    No cards on file.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {filterMethods(cards).map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 ${
                          m.is_primary ? "border-l-4 border-l-blue-500" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-blue-400" />
                          {m.is_primary ? (
                            <span className="rounded-full bg-blue-950/80 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-300">
                              Primary
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs font-semibold uppercase text-zinc-500">{cardLabel(m.brand)}</p>
                        <p className="font-mono text-lg font-bold text-white">{maskPan(m.last4)}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {!m.is_primary ? (
                            <button type="button" className={BTN_GHOST} onClick={() => onPrimary(m.id)}>
                              Set primary
                            </button>
                          ) : null}
                          <button type="button" className="text-xs font-semibold text-red-400 hover:underline" onClick={() => onRemove(m.id)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="text-base font-semibold text-white">Bank accounts</h2>
                {methodsHook.loading ? null : filterMethods(banks).length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/50 p-6 text-sm text-zinc-500">
                    No linked banks.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {filterMethods(banks).map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                            {m.rail === "wire_swift" ? <Landmark className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                          </span>
                          <div>
                            <p className="font-semibold text-white">
                              {m.bank_name ?? "Bank"} •• {m.last4}
                            </p>
                            <p className="text-sm text-zinc-500">{railLabel(m.rail)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!m.is_primary ? (
                            <button type="button" className={BTN_SECONDARY} onClick={() => onPrimary(m.id)}>
                              Set primary
                            </button>
                          ) : null}
                          <button type="button" className={`${BTN_DANGER} inline-flex items-center gap-1`} onClick={() => onRemove(m.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-950/50 py-4 text-sm font-semibold text-zinc-300 hover:border-blue-700 hover:bg-zinc-900"
              >
                <Plus className="h-5 w-5 text-blue-400" />
                Add payment method
              </button>
            </div>

            <aside className="space-y-4">
              <div className={`${PANEL} border-l-4 border-l-amber-600/80`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">Next billing reminder</p>
                {summaryHook.loading ? (
                  <p className="mt-2 text-sm text-zinc-500">…</p>
                ) : summaryHook.data ? (
                  <>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                      {summaryHook.data.next_billing_date
                        ? new Date(summaryHook.data.next_billing_date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">{summaryHook.data.billing_cycle} cycle</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">—</p>
                )}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 ring-1 ring-zinc-800">
                <Shield className="h-8 w-8 text-blue-400" />
                <p className="mt-4 text-sm font-semibold text-white">Secure handling</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  {summaryHook.data?.encryption_note ??
                    "Mock environment: only metadata such as last four digits is stored."}
                </p>
              </div>
            </aside>
          </div>
        </div>
      )}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => {
            setModalOpen(false);
            resetModal();
          }}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pay-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pay-modal-title" className="text-lg font-bold text-white">
              Add payment method
            </h2>
            <p className="mt-1 text-xs text-zinc-500">Mock storage — full PAN is not retained.</p>

            <div className="mt-4 flex rounded-lg border border-zinc-700 p-0.5">
              <button
                type="button"
                className={`flex-1 rounded-md py-2 text-xs font-bold ${
                  modalKind === "card" ? "bg-blue-950 text-blue-200 ring-1 ring-blue-800" : "text-zinc-500"
                }`}
                onClick={() => setModalKind("card")}
              >
                Card
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md py-2 text-xs font-bold ${
                  modalKind === "bank" ? "bg-blue-950 text-blue-200 ring-1 ring-blue-800" : "text-zinc-500"
                }`}
                onClick={() => setModalKind("bank")}
              >
                Bank
              </button>
            </div>

            {modalKind === "card" ? (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-medium text-zinc-400">
                  Card number
                  <input className={INPUT} value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4242…" autoComplete="off" />
                </label>
                <label className="block text-xs font-medium text-zinc-400">
                  Expiry (MM/YY)
                  <input className={INPUT} value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="08/26" />
                </label>
                <label className="block text-xs font-medium text-zinc-400">
                  Name on card
                  <input className={INPUT} value={holderName} onChange={(e) => setHolderName(e.target.value)} />
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" checked={makePrimary} onChange={(e) => setMakePrimary(e.target.checked)} />
                  Set as primary
                </label>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-medium text-zinc-400">
                  Bank name
                  <input className={INPUT} value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </label>
                <label className="block text-xs font-medium text-zinc-400">
                  Last 4 of account
                  <input
                    className={INPUT}
                    value={accountLast4}
                    onChange={(e) => setAccountLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                  />
                </label>
                <label className="block text-xs font-medium text-zinc-400">
                  Rail
                  <select
                    className={INPUT}
                    value={rail}
                    onChange={(e) => setRail(e.target.value as "ach" | "wire_swift")}
                  >
                    <option value="ach">ACH</option>
                    <option value="wire_swift">Wire / SWIFT</option>
                  </select>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" checked={bankPrimary} onChange={(e) => setBankPrimary(e.target.checked)} />
                  Set as primary
                </label>
              </div>
            )}

            {formError ? <p className="mt-3 text-sm text-red-400">{formError}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() => {
                  setModalOpen(false);
                  resetModal();
                }}
              >
                Cancel
              </button>
              <button type="button" disabled={submitting} className={BTN_PRIMARY} onClick={() => void onAdd()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
