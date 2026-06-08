"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OperationalImprovementDetailPanel } from "@/components/operational-improvements/OperationalImprovementDetailPanel";
import { OperationalImprovementsDashboard } from "@/components/operational-improvements/OperationalImprovementsDashboard";
import { OperationalImprovementsKnowledgeBase } from "@/components/operational-improvements/OperationalImprovementsKnowledgeBase";
import { OperationalImprovementsListTab } from "@/components/operational-improvements/OperationalImprovementsListTab";
import { OperationalImprovementsPlaybooks } from "@/components/operational-improvements/OperationalImprovementsPlaybooks";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchOperationalImprovementStats } from "@/lib/operational-improvements/api";
import type { OperationalImprovementListRow, OperationalImprovementStats } from "@/lib/operational-improvements/types";
import { hasRbacPermission } from "@/lib/rbac/session-access";
import { readSession } from "@/lib/pulse-session";
import { cn } from "@/lib/cn";

type Tab = "dashboard" | "opportunities" | "knowledge" | "playbooks";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "opportunities", label: "Opportunities" },
  { id: "playbooks", label: "Playbooks" },
  { id: "knowledge", label: "Knowledge base" },
];

export function OperationalImprovementsApp() {
  const searchParams = useSearchParams();
  const session = readSession();
  const canManage = hasRbacPermission(session, "operational_improvements.manage");

  const initialTab = useMemo(() => {
    const raw = searchParams.get("tab");
    return raw === "knowledge" || raw === "opportunities" || raw === "dashboard" || raw === "playbooks" ? raw : "dashboard";
  }, [searchParams]);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [stats, setStats] = useState<OperationalImprovementStats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await fetchOperationalImprovementStats());
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  function openDetail(row: OperationalImprovementListRow) {
    setSelectedId(row.id);
    setDetailOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 pb-10">
      <PageHeader
        icon={Sparkles}
        title="Operational Improvements"
        description="Problem → analysis → improvement → measurement → organizational learning. Industry-agnostic continuous improvement — not project management."
      />

      <nav className="flex flex-wrap gap-1 border-b border-ds-border" role="tablist" aria-label="Operational improvements">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cn(
              "rounded-t-lg px-3 py-2 text-sm font-semibold",
              tab === id ? "border-b-2 border-ds-accent text-ds-accent" : "text-ds-muted hover:text-ds-foreground",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" ? <OperationalImprovementsDashboard stats={stats} /> : null}
      {tab === "opportunities" ? (
        <OperationalImprovementsListTab onSelect={openDetail} onToast={setToast} canManage={canManage} />
      ) : null}
      {tab === "knowledge" ? <OperationalImprovementsKnowledgeBase onToast={setToast} /> : null}
      {tab === "playbooks" ? <OperationalImprovementsPlaybooks onToast={setToast} /> : null}

      {toast ? (
        <div
          className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-foreground shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <OperationalImprovementDetailPanel
        improvementId={selectedId}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedId(null);
        }}
        onUpdated={() => void refreshStats()}
        onToast={setToast}
        canManage={canManage}
      />
    </div>
  );
}
