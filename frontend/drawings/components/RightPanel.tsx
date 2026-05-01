"use client";

import { useEffect, useMemo, useState } from "react";
import type { InfraAsset, InfraConnection, SystemType } from "../utils/graphHelpers";

type AttributeRow = { id: string; key: string; value: string };

export function RightPanel({
  selectedAssets,
  selectedConnections,
  asset,
  connection,
  onClose,
  onSaveAsset,
  onLoadAttributes,
  onAddAttribute,
  disabled,
}: {
  selectedAssets: string[];
  selectedConnections: string[];
  asset: InfraAsset | null;
  connection: InfraConnection | null;
  onClose: () => void;
  onSaveAsset: (patch: Partial<Omit<InfraAsset, "id">>) => Promise<void>;
  onLoadAttributes: (opts: { entity_type: "asset" | "connection"; entity_id: string }) => Promise<Array<{ id: string; key: string; value: string }>>;
  onAddAttribute: (opts: { entity_type: "asset" | "connection"; entity_id: string; key: string; value: string }) => Promise<void>;
  disabled?: boolean;
}) {
  const entity = asset ? { kind: "asset" as const, id: asset.id } : connection ? { kind: "connection" as const, id: connection.id } : null;
  const [tab, setTab] = useState<"details" | "attributes">("details");
  const [attrs, setAttrs] = useState<AttributeRow[]>([]);
  const [attrsLoading, setAttrsLoading] = useState(false);
  const [attrKey, setAttrKey] = useState("");
  const [attrValue, setAttrValue] = useState("");

  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState("");
  const [draftSystem, setDraftSystem] = useState<SystemType>("telemetry");
  const [draftNotes, setDraftNotes] = useState("");

  useEffect(() => {
    if (asset) {
      setDraftName(asset.name ?? "");
      setDraftType(asset.type ?? "asset");
      setDraftSystem(asset.system_type);
      setDraftNotes(asset.notes ?? "");
    }
  }, [asset]);

  useEffect(() => {
    if (!entity) return;
    setAttrs([]);
    setAttrsLoading(true);
    void (async () => {
      try {
        const rows = await onLoadAttributes({ entity_type: entity.kind, entity_id: entity.id });
        setAttrs(rows);
      } finally {
        setAttrsLoading(false);
      }
    })();
  }, [entity?.id, entity?.kind, onLoadAttributes]);

  const title = useMemo(() => {
    if (asset) return "Asset";
    if (connection) return "Connection";
    return "Selection";
  }, [asset, connection]);

  if (!entity) return null;

  return (
    <aside className="w-[300px] shrink-0 bg-ds-secondary/15 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ds-foreground">{title}</p>
          {selectedAssets.length + selectedConnections.length > 1 ? (
            <p className="text-[11px] text-ds-muted">
              {selectedAssets.length} assets, {selectedConnections.length} connections selected
            </p>
          ) : (
            <p className="text-[11px] text-ds-muted break-all">{entity.id}</p>
          )}
        </div>
        <button type="button" className="rounded-lg px-2 py-1 text-sm font-semibold text-ds-muted hover:bg-ds-secondary/50 hover:text-ds-foreground" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="mt-2 flex gap-1 rounded-md border border-ds-border/70 bg-ds-primary/30 p-1">
        <button
          type="button"
          className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${tab === "details" ? "bg-ds-primary text-ds-foreground" : "text-ds-muted hover:text-ds-foreground"}`}
          onClick={() => setTab("details")}
        >
          Details
        </button>
        <button
          type="button"
          className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${tab === "attributes" ? "bg-ds-primary text-ds-foreground" : "text-ds-muted hover:text-ds-foreground"}`}
          onClick={() => setTab("attributes")}
        >
          Attributes
        </button>
      </div>

      {selectedAssets.length + selectedConnections.length > 1 ? (
        <div className="mt-2 rounded-md border border-ds-border/70 bg-ds-primary/25 p-2 text-xs text-ds-muted">
          Bulk actions are coming next. For now, select a single asset/connection to edit details.
        </div>
      ) : tab === "details" ? (
        <div className="mt-2 space-y-2">
          {asset ? (
            <>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Name</span>
                <input className="app-field mt-1.5 w-full" value={draftName} onChange={(e) => setDraftName(e.target.value)} disabled={disabled} />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Type</span>
                <input className="app-field mt-1.5 w-full" value={draftType} onChange={(e) => setDraftType(e.target.value)} disabled={disabled} />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">System</span>
                <select className="app-field mt-1.5 w-full" value={draftSystem} onChange={(e) => setDraftSystem(e.target.value as SystemType)} disabled={disabled}>
                  <option value="fiber">Fiber</option>
                  <option value="irrigation">Irrigation</option>
                  <option value="electrical">Electrical</option>
                  <option value="telemetry">Telemetry</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Notes</span>
                <textarea className="app-field mt-1.5 w-full min-h-24" value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} disabled={disabled} />
              </label>
              <button
                type="button"
                className="ds-btn-primary w-full"
                disabled={disabled}
                onClick={() =>
                  void onSaveAsset({
                    name: draftName,
                    type: draftType,
                    system_type: draftSystem,
                    notes: draftNotes,
                  })
                }
              >
                Save
              </button>
            </>
          ) : (
            <div className="rounded-md border border-ds-border/70 bg-ds-primary/25 p-2 text-xs text-ds-muted">
              Connection details editing is coming next.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {attrsLoading ? <p className="text-sm text-ds-muted">Loading…</p> : null}
          {attrs.length === 0 && !attrsLoading ? (
            <p className="text-sm text-ds-muted">No attributes yet.</p>
          ) : (
            <ul className="space-y-2">
              {attrs.map((a) => (
                <li key={a.id} className="rounded-md border border-ds-border/70 bg-ds-primary/25 px-2 py-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{a.key}</p>
                  <p className="mt-0.5 text-sm text-ds-foreground break-words">{a.value}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-md border border-ds-border/70 bg-ds-primary/25 p-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Add attribute</p>
            <div className="mt-2 space-y-2">
              <input className="app-field w-full" placeholder="key" value={attrKey} onChange={(e) => setAttrKey(e.target.value)} disabled={disabled} />
              <input className="app-field w-full" placeholder="value" value={attrValue} onChange={(e) => setAttrValue(e.target.value)} disabled={disabled} />
              <button
                type="button"
                className="ds-btn-secondary w-full"
                disabled={disabled || !attrKey.trim()}
                onClick={() =>
                  void (async () => {
                    const key = attrKey.trim();
                    const value = attrValue.trim();
                    if (!key) return;
                    await onAddAttribute({ entity_type: entity.kind, entity_id: entity.id, key, value });
                    setAttrKey("");
                    setAttrValue("");
                    const rows = await onLoadAttributes({ entity_type: entity.kind, entity_id: entity.id });
                    setAttrs(rows);
                  })()
                }
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

