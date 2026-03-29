"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type LogRow = {
  id: string;
  action: string;
  performed_by: string | null;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  logged_at: string;
};

export default function SystemLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await apiFetch<LogRow[]>("/api/system/logs?limit=200");
        setRows(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">System logs</h1>
        <p className="mt-1 text-sm text-zinc-500">Sensitive actions from the internal admin surface.</p>
      </div>
      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950/50">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">{r.logged_at}</td>
                  <td className="px-4 py-3 text-zinc-200">{r.action}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{r.performed_by || "—"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {r.target_type || "—"}:{r.target_id || "—"}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-zinc-500">
                    {JSON.stringify(r.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
