"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPreventativeRule,
  fetchPreventativeRules,
  fetchProcedures,
  patchPreventativeRule,
  type PreventativeRuleRow,
  type ProcedureRow,
} from "@/lib/cmmsApi";
import { parseClientApiError } from "@/lib/parse-client-api-error";

export function PreventativeMaintenanceApp() {
  const [rules, setRules] = useState<PreventativeRuleRow[]>([]);
  const [procedures, setProcedures] = useState<ProcedureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [assetId, setAssetId] = useState("");
  const [frequency, setFrequency] = useState("30 days");
  const [procedureId, setProcedureId] = useState("");
  const [editing, setEditing] = useState<PreventativeRuleRow | null>(null);
  const [editAsset, setEditAsset] = useState("");
  const [editFrequency, setEditFrequency] = useState("");
  const [editProcedureId, setEditProcedureId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [r, p] = await Promise.all([fetchPreventativeRules(), fetchProcedures()]);
      setRules(r);
      setProcedures(p);
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editing) return;
    setEditAsset(editing.asset_id);
    setEditFrequency(editing.frequency);
    setEditProcedureId(editing.procedure_id ?? "");
  }, [editing]);

  const addRule = async () => {
    const aid = assetId.trim();
    if (!aid) return;
    setSaving(true);
    setErr(null);
    try {
      await createPreventativeRule({
        asset_id: aid,
        frequency: frequency.trim() || "30 days",
        procedure_id: procedureId || null,
      });
      setAssetId("");
      await load();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const aid = editAsset.trim();
    if (!aid) return;
    setSaving(true);
    setErr(null);
    try {
      await patchPreventativeRule(editing.id, {
        asset_id: aid,
        frequency: editFrequency.trim() || "30 days",
        procedure_id: editProcedureId || null,
      });
      setEditing(null);
      await load();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-pulse-border bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-900/50">
        <h2 className="text-sm font-semibold text-pulse-navy dark:text-slate-100">Add rule</h2>
        <p className="mt-1 text-xs text-pulse-muted">
          Tie a facility equipment id to a frequency string. Generation of work orders from rules is not automated yet.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[12rem] flex-1 rounded-lg border border-pulse-border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            placeholder="Asset ID (facility_equipment.id)"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          />
          <input
            className="w-36 rounded-lg border border-pulse-border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          />
          <select
            className="min-w-[10rem] rounded-lg border border-pulse-border px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            value={procedureId}
            onChange={(e) => setProcedureId(e.target.value)}
          >
            <option value="">— Procedure —</option>
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving || !assetId.trim()}
            onClick={() => void addRule()}
            className="rounded-lg bg-pulse-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save rule
          </button>
        </div>
      </section>

      {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}

      <section className="rounded-2xl border border-pulse-border bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-900/50">
        <h2 className="text-sm font-semibold text-pulse-navy dark:text-slate-100">Rules</h2>
        {loading ? (
          <p className="mt-2 text-sm text-pulse-muted">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="mt-2 text-sm text-pulse-muted">No preventative rules yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-pulse-border dark:divide-slate-700">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-pulse-navy dark:text-slate-200">{r.asset_id}</p>
                  <p className="text-pulse-muted">
                    {r.frequency}
                    {r.procedure_id ? (
                      <>
                        {" "}
                        · procedure{" "}
                        <span className="font-mono text-xs">
                          {procedures.find((p) => p.id === r.procedure_id)?.title ?? r.procedure_id}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="shrink-0 rounded-lg border border-pulse-border px-2 py-1 text-xs font-semibold dark:border-slate-600"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-pulse-navy dark:text-slate-100">Edit rule</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="min-w-[12rem] flex-1 rounded-lg border border-pulse-border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={editAsset}
              onChange={(e) => setEditAsset(e.target.value)}
            />
            <input
              className="w-36 rounded-lg border border-pulse-border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={editFrequency}
              onChange={(e) => setEditFrequency(e.target.value)}
            />
            <select
              className="min-w-[10rem] rounded-lg border border-pulse-border px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={editProcedureId}
              onChange={(e) => setEditProcedureId(e.target.value)}
            >
              <option value="">— Procedure —</option>
              {procedures.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !editAsset.trim()}
              onClick={() => void saveEdit()}
              className="rounded-lg bg-pulse-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-pulse-border px-3 py-2 text-sm font-semibold dark:border-slate-600"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
