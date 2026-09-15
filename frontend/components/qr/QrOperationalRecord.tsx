"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen, ClipboardCheck, History, Siren, Wrench } from "lucide-react";

export type OperationalRecord = {
  resource_type: string;
  guest?: boolean;
  available?: {
    asset?: boolean;
    sops?: boolean;
    pms?: boolean;
    work_history?: boolean;
    emergency?: boolean;
  };
  asset?: {
    id: string;
    name: string;
    type: string;
    status: string;
    model?: string | null;
    zone_name?: string | null;
    href: string;
  };
  sops?: Array<{ id: string; title: string; href: string; is_critical?: boolean; kind?: string }>;
  pms?: Array<{ id: string; name: string; next_due_at?: string; overdue?: boolean; href: string }>;
  work_history?: Array<{ id: string; title: string; status: string; href: string }>;
  emergency?: {
    facility_name?: string | null;
    emergency_procedures?: string | null;
    disclaimer?: string;
    href?: string;
    articles?: Array<{ id: string; title: string; href: string }>;
    contacts?: Array<{ id: string; title: string; phone?: string | null; href: string }>;
  };
};

function Section({
  icon: Icon,
  title,
  available,
  children,
}: {
  icon: typeof Wrench;
  title: string;
  available?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-ds-border bg-white p-4 shadow-sm dark:bg-ds-card">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ds-foreground">
        <Icon className="h-4 w-4 text-ds-primary" aria-hidden />
        {title}
        {available === false ? (
          <span className="rounded bg-ds-muted/20 px-1.5 py-0.5 text-[10px] font-medium text-ds-muted">None on file</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

export function QrOperationalRecord({ record }: { record: OperationalRecord }) {
  const asset = record.asset;
  const emergency = record.emergency;
  return (
    <div className="mx-auto w-full max-w-lg space-y-3 p-4 pb-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Asset record</p>
        <h1 className="text-xl font-bold text-ds-foreground">{asset?.name ?? "Asset"}</h1>
        <p className="text-sm text-ds-muted">
          {asset?.type}
          {asset?.zone_name ? ` · ${asset.zone_name}` : ""}
          {asset?.status ? ` · ${asset.status}` : ""}
        </p>
        {asset?.href ? (
          <Link href={asset.href} className="mt-1 inline-block text-sm font-semibold text-[#2B4C7E] hover:underline">
            Open full equipment page
          </Link>
        ) : null}
      </header>

      <Section icon={Siren} title="Emergency info" available={record.available?.emergency}>
        {emergency?.disclaimer ? <p className="mb-2 text-xs text-amber-800">{emergency.disclaimer}</p> : null}
        {emergency?.emergency_procedures ? (
          <pre className="whitespace-pre-wrap font-sans text-sm text-ds-foreground">{emergency.emergency_procedures}</pre>
        ) : (
          <p className="text-sm text-ds-muted">No facility emergency procedure on this asset yet.</p>
        )}
        {emergency?.articles?.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {emergency.articles.map((a) => (
              <li key={a.id}>
                <Link href={a.href} className="font-medium text-[#2B4C7E] hover:underline">
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {emergency?.contacts?.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {emergency.contacts.map((c) => (
              <li key={c.id}>
                {c.title}
                {c.phone ? ` · ${c.phone}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
        {emergency?.href ? (
          <Link href={emergency.href} className="mt-2 inline-block text-xs font-semibold text-[#2B4C7E] hover:underline">
            Emergency hub
          </Link>
        ) : null}
      </Section>

      <Section icon={BookOpen} title="Linked SOPs" available={record.available?.sops}>
        {record.sops?.length ? (
          <ul className="space-y-1 text-sm">
            {record.sops.map((s) => (
              <li key={s.id}>
                <Link href={s.href} className="font-medium text-[#2B4C7E] hover:underline">
                  {s.title}
                </Link>
                {s.is_critical ? <span className="ml-1 text-[10px] uppercase text-rose-700">critical</span> : null}
                {s.kind === "internal_procedure" ? (
                  <span className="ml-1 text-[10px] text-ds-muted">internal procedure</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ds-muted">No matching SOPs on file for this asset.</p>
        )}
      </Section>

      <Section icon={ClipboardCheck} title="Preventive maintenance" available={record.available?.pms}>
        {record.pms?.length ? (
          <ul className="space-y-1 text-sm">
            {record.pms.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-2">
                <span>{p.name}</span>
                {p.overdue ? (
                  <span className="inline-flex items-center gap-1 text-xs text-rose-700">
                    <AlertTriangle className="h-3 w-3" /> overdue
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ds-muted">No PM tasks linked yet.</p>
        )}
      </Section>

      <Section icon={History} title="Work history" available={record.available?.work_history}>
        {record.work_history?.length ? (
          <ul className="space-y-1 text-sm">
            {record.work_history.map((w) => (
              <li key={w.id}>
                <Link href={w.href} className="text-[#2B4C7E] hover:underline">
                  {w.title}
                </Link>
                <span className="text-ds-muted"> · {w.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ds-muted">No work requests on this asset yet.</p>
        )}
      </Section>
    </div>
  );
}
