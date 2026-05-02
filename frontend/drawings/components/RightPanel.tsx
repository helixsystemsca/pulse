"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import type { BlueprintElement } from "@/components/zones-devices/blueprint-types";
import type { InfraAsset, InfraConnection, SystemType } from "../utils/graphHelpers";
import { parseInfraAssetFromNotes } from "../utils/infraSymbolNotes";
import { ZONE_META_PREFIX, packZoneMeta, parseZoneMeta } from "../utils/overlayMeta";

type AttributeRow = { id: string; key: string; value: string };

function proceduresLinesFromStored(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (t.startsWith("[")) {
    try {
      const j = JSON.parse(t) as unknown;
      if (Array.isArray(j) && j.every((x) => typeof x === "string")) return (j as string[]).join("\n");
    } catch {
      /* legacy newline-separated */
    }
  }
  return t;
}

function proceduresToStored(textarea: string): string {
  const lines = textarea.split("\n").map((s) => s.trim()).filter(Boolean);
  return JSON.stringify(lines);
}

export function RightPanel({
  selectedAssets,
  selectedConnections,
  asset,
  connection,
  blueprintElement,
  onClose,
  onSaveAsset,
  onSaveBlueprintPatch,
  onLoadAttributes,
  onAddAttribute,
  disabled,
}: {
  selectedAssets: string[];
  selectedConnections: string[];
  asset: InfraAsset | null;
  connection: InfraConnection | null;
  blueprintElement?: BlueprintElement | null;
  onClose: () => void;
  onSaveAsset: (patch: Partial<Omit<InfraAsset, "id">>) => Promise<void>;
  onSaveBlueprintPatch?: (id: string, patch: Partial<BlueprintElement>) => Promise<void>;
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
  const [draftProcedures, setDraftProcedures] = useState("");
  const [draftConnNotes, setDraftConnNotes] = useState("");

  const [bpDraftName, setBpDraftName] = useState("");
  const [bpZoneType, setBpZoneType] = useState("");
  const [bpZoneNotes, setBpZoneNotes] = useState("");
  const [bpSymbolType, setBpSymbolType] = useState("marker");
  const [bpOverlayNotes, setBpOverlayNotes] = useState("");
  const [bpInfraLinked, setBpInfraLinked] = useState(false);

  useEffect(() => {
    if (asset) {
      setDraftName(asset.name ?? "");
      setDraftType(asset.type ?? "asset");
      setDraftSystem(asset.system_type);
      setDraftNotes(asset.notes ?? "");
    }
  }, [asset]);

  useEffect(() => {
    if (!blueprintElement) return;
    setBpDraftName(blueprintElement.name ?? "");
    const linked = Boolean(parseInfraAssetFromNotes(blueprintElement.symbol_notes));
    setBpInfraLinked(linked);
    if (blueprintElement.type === "zone") {
      const zm = parseZoneMeta(blueprintElement.symbol_notes);
      setBpZoneType(zm.zone_type);
      setBpZoneNotes(zm.notes);
      setBpOverlayNotes("");
    } else {
      setBpZoneType("");
      setBpZoneNotes("");
      const sn = blueprintElement.symbol_notes ?? "";
      if (linked || sn.startsWith(ZONE_META_PREFIX)) {
        setBpOverlayNotes("");
      } else {
        setBpOverlayNotes(sn);
      }
    }
    if (blueprintElement.type === "symbol") {
      setBpSymbolType(blueprintElement.symbol_type ?? "marker");
    }
  }, [blueprintElement]);

  useEffect(() => {
    if (!entity) return;
    setAttrs([]);
    setAttrsLoading(true);
    void (async () => {
      try {
        const rows = await onLoadAttributes({ entity_type: entity.kind, entity_id: entity.id });
        setAttrs(rows);
        if (entity.kind === "asset") {
          const proc = rows.find((r) => r.key === "procedure_steps");
          setDraftProcedures(proceduresLinesFromStored(proc?.value ?? ""));
        }
        if (entity.kind === "connection") {
          setDraftConnNotes(rows.find((r) => r.key === "notes")?.value ?? "");
        }
      } finally {
        setAttrsLoading(false);
      }
    })();
  }, [entity?.id, entity?.kind, onLoadAttributes]);

  const title = useMemo(() => {
    if (asset) return "Asset";
    if (connection) return "Connection";
    if (blueprintElement?.type === "zone") return "Zone";
    if (blueprintElement?.type === "symbol") return "Annotation";
    if (blueprintElement?.type === "path") {
      return blueprintElement.symbol_type === "map_pen" ? "Markup (freehand)" : "Region sketch";
    }
    if (blueprintElement?.type === "polygon") return "Area overlay";
    return "Selection";
  }, [asset, blueprintElement, connection]);

  // Blueprint-only selection (non-graph overlay / zones)
  if (!entity && blueprintElement && onSaveBlueprintPatch) {
    const isZone = blueprintElement.type === "zone";
    const isAnnotSymbol = blueprintElement.type === "symbol";
    const isAnnotPath = blueprintElement.type === "path";

    return (
      <aside className="w-[300px] shrink-0 bg-ds-secondary/15 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-ds-foreground">{title}</p>
            <p className="text-[11px] text-ds-muted break-all">{blueprintElement.id}</p>
          </div>
          <button type="button" className="rounded-lg px-2 py-1 text-sm font-semibold text-ds-muted hover:bg-ds-secondary/50 hover:text-ds-foreground" onClick={onClose}>
            ×
          </button>
        </div>

        {bpInfraLinked ? (
          <p className="mt-2 rounded-md border border-ds-border/60 bg-ds-primary/20 px-2 py-1.5 text-[11px] text-ds-muted">
            This footprint is linked to an infrastructure asset. Edit the asset in the graph inspector when the asset is selected.
          </p>
        ) : null}

        <div className="mt-2 space-y-2">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{isZone ? "Name" : "Label"}</span>
            <input className="app-field mt-1.5 w-full" value={bpDraftName} onChange={(e) => setBpDraftName(e.target.value)} disabled={disabled} />
          </label>

          {isZone ? (
            <>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Zone type</span>
                <input
                  className="app-field mt-1.5 w-full"
                  value={bpZoneType}
                  onChange={(e) => setBpZoneType(e.target.value)}
                  disabled={disabled}
                  placeholder="e.g. area, floor, yard"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Notes</span>
                <textarea className="app-field mt-1.5 w-full min-h-20" value={bpZoneNotes} onChange={(e) => setBpZoneNotes(e.target.value)} disabled={disabled} />
              </label>
            </>
          ) : null}

          {isAnnotSymbol ? (
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Symbol</span>
              <select className="app-field mt-1.5 w-full" value={bpSymbolType} onChange={(e) => setBpSymbolType(e.target.value)} disabled={disabled || bpInfraLinked}>
                <option value="marker">Marker</option>
                <option value="label">Text plate</option>
                <option value="tree">Tree</option>
                <option value="generic">Generic</option>
              </select>
            </label>
          ) : null}

          {(isAnnotSymbol || isAnnotPath) && !bpInfraLinked ? (
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Overlay notes</span>
              <textarea
                className="app-field mt-1.5 w-full min-h-16"
                value={bpOverlayNotes}
                onChange={(e) => setBpOverlayNotes(e.target.value)}
                disabled={disabled}
                placeholder="Internal notes (blueprint only)"
              />
            </label>
          ) : null}

          {!isZone && blueprintElement.type === "polygon" ? (
            <p className="text-[10px] leading-snug text-ds-muted">
              Unlinked blueprint polygon — use Add asset with polygon placement for structured infrastructure areas.
            </p>
          ) : null}

          <button
            type="button"
            className={cn(buttonVariants({ surface: "light", intent: "accent" }), "w-full")}
            disabled={disabled}
            onClick={() =>
              void (async () => {
                if (bpInfraLinked) {
                  await onSaveBlueprintPatch(blueprintElement.id, { name: bpDraftName });
                  return;
                }
                if (isZone) {
                  const zn = packZoneMeta({ zone_type: bpZoneType, notes: bpZoneNotes });
                  await onSaveBlueprintPatch(blueprintElement.id, {
                    name: bpDraftName,
                    ...(zn ? { symbol_notes: zn } : {}),
                  });
                  return;
                }
                await onSaveBlueprintPatch(blueprintElement.id, {
                  name: bpDraftName,
                  ...(isAnnotSymbol ? { symbol_type: bpSymbolType } : {}),
                  ...(isAnnotSymbol || isAnnotPath ? { symbol_notes: bpOverlayNotes.trim() ? bpOverlayNotes.trim() : undefined } : {}),
                });
              })()
            }
          >
            Save
          </button>

          <p className="text-[10px] leading-snug text-ds-muted">
            Overlay elements stay on the blueprint image — they are not graph nodes. Infrastructure lives in assets and connections.
          </p>
        </div>
      </aside>
    );
  }

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
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Procedures</span>
                <span className="mt-1 block text-[10px] text-ds-muted">One step per line (stored as a JSON array on the asset).</span>
                <textarea
                  className="app-field mt-1.5 w-full min-h-28"
                  value={draftProcedures}
                  onChange={(e) => setDraftProcedures(e.target.value)}
                  disabled={disabled}
                  placeholder={"Step 1\nStep 2"}
                />
              </label>
              <button
                type="button"
                className={cn(buttonVariants({ surface: "light", intent: "accent" }), "w-full")}
                disabled={disabled}
                onClick={() =>
                  void (async () => {
                    await onSaveAsset({
                      name: draftName,
                      type: draftType,
                      system_type: draftSystem,
                      notes: draftNotes,
                    });
                    await onAddAttribute({
                      entity_type: "asset",
                      entity_id: asset.id,
                      key: "procedure_steps",
                      value: proceduresToStored(draftProcedures),
                    });
                    const rows = await onLoadAttributes({ entity_type: "asset", entity_id: asset.id });
                    setAttrs(rows);
                  })()
                }
              >
                Save
              </button>
            </>
          ) : connection ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Endpoints</p>
              <p className="break-all text-xs text-ds-foreground">{connection.from_asset_id}</p>
              <p className="break-all text-xs text-ds-foreground">{connection.to_asset_id}</p>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">System</span>
                <input className="app-field mt-1.5 w-full opacity-80" readOnly value={connection.system_type} />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Connection type</span>
                <input className="app-field mt-1.5 w-full opacity-80" readOnly value={connection.connection_type} />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Notes</span>
                <span className="mt-1 block text-[10px] text-ds-muted">Stored as attribute <span className="font-mono">notes</span>.</span>
                <textarea className="app-field mt-1.5 w-full min-h-24" value={draftConnNotes} onChange={(e) => setDraftConnNotes(e.target.value)} disabled={disabled} />
              </label>
              <button
                type="button"
                className={cn(buttonVariants({ surface: "light", intent: "accent" }), "w-full")}
                disabled={disabled}
                onClick={() =>
                  void (async () => {
                    await onAddAttribute({
                      entity_type: "connection",
                      entity_id: connection.id,
                      key: "notes",
                      value: draftConnNotes,
                    });
                    const rows = await onLoadAttributes({ entity_type: "connection", entity_id: connection.id });
                    setAttrs(rows);
                  })()
                }
              >
                Save notes
              </button>
              <p className="text-[10px] text-ds-muted">Additional structured fields live under the Attributes tab.</p>
            </>
          ) : null}
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
                className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "w-full")}
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
