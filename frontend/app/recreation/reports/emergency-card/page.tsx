"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import {
  fetchIntelligence,
  fetchProfile,
  type OpsIntelligence,
  type OpsPersonalProfile,
} from "@/lib/recreation/commandService";

export default function EmergencyCardPrintPage() {
  const [profile, setProfile] = useState<OpsPersonalProfile | null>(null);
  const [intel, setIntel] = useState<OpsIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([fetchProfile(), fetchIntelligence()])
      .then(([p, i]) => {
        setProfile(p);
        setIntel(i);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const em = (intel?.emergency || {}) as Record<string, unknown>;
  const gaps = (em.readiness_gaps as string[] | undefined) || [];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link href="/recreation/reports" className="text-sm text-slate-600 underline">
            ← Reports
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <article className="rounded-xl border-2 border-slate-900 p-6 print:rounded-none print:border print:p-4">
          <header className="border-b-2 border-slate-900 pb-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              My Role
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">EMERGENCY CARD</h1>
            <p className="mt-2 text-sm text-slate-600">
              {profile?.display_name || "Coordinator"}
              {profile?.position ? ` · ${profile.position}` : ""}
            </p>
            {profile?.contact_info ? (
              <p className="mt-1 text-sm text-slate-700">{profile.contact_info}</p>
            ) : null}
          </header>

          <section className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded border border-slate-300 p-2">
              <p className="text-[10px] uppercase text-slate-500">Facilities</p>
              <p className="text-xl font-semibold">{Number(em.facilities_with_procedures ?? 0)}</p>
            </div>
            <div className="rounded border border-slate-300 p-2">
              <p className="text-[10px] uppercase text-slate-500">Contacts</p>
              <p className="text-xl font-semibold">{Number(em.emergency_contacts ?? 0)}</p>
            </div>
            <div className="rounded border border-slate-300 p-2">
              <p className="text-[10px] uppercase text-slate-500">Articles</p>
              <p className="text-xl font-semibold">{Number(em.emergency_knowledge_articles ?? 0)}</p>
            </div>
          </section>

          {gaps.length ? (
            <section className="mt-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-red-800">Readiness gaps</h2>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Basic emergency sources look populated.</p>
          )}

          <section className="mt-4 text-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">In Pulse</h2>
            <ul className="mt-1 space-y-0.5">
              <li>/recreation/emergency — readiness hub</li>
              <li>/recreation/facilities — facility procedures</li>
              <li>/recreation/contacts — emergency contacts</li>
              <li>/recreation/knowledge — Emergency Procedures articles</li>
            </ul>
          </section>

          <footer className="mt-6 border-t border-slate-300 pt-2 text-center text-[10px] uppercase tracking-wide text-slate-500">
            Personal ops card · not a municipal EOC plan · {new Date().toLocaleDateString()}
          </footer>
        </article>
      </div>
    </div>
  );
}
