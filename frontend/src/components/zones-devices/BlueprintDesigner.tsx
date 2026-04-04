"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { apiFetch } from "@/lib/api";
import "./blueprint-designer.css";

/** Frontend blueprint element (API uses the same shape; optional fields match OpenAPI). */
export type BlueprintElement = {
  id: string;
  type: "zone" | "device";
  x: number;
  y: number;
  width?: number;
  height?: number;
  name?: string;
  rotation?: number;
  linked_device_id?: string;
  assigned_zone_id?: string;
  device_kind?: string;
};

type Tool = "select" | "draw-room" | "place-device";
type DeviceKind = "pump" | "tank" | "sensor" | "generic";

type BlueprintSummary = { id: string; name: string; created_at: string };
type ApiElement = {
  id: string;
  type: "zone" | "device";
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  name?: string | null;
  rotation?: number;
  linked_device_id?: string | null;
  assigned_zone_id?: string | null;
  device_kind?: string | null;
};

type BlueprintDetail = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  elements: ApiElement[];
};

const GRID = 32;
const DEVICE_DEFAULT = 44;
const MIN_ZONE = 24;

function mockLinkStatus(linkedId: string | undefined): "neutral" | "normal" | "warning" | "alarm" {
  if (!linkedId) return "neutral";
  const n = linkedId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const m = n % 4;
  if (m === 0) return "normal";
  if (m === 1) return "warning";
  return "alarm";
}

const STATUS_FILL: Record<string, string> = {
  neutral: "#64748b",
  normal: "#22c55e",
  warning: "#eab308",
  alarm: "#ef4444",
};

function getWorldFromStage(stage: Konva.Stage | null): { x: number; y: number } | null {
  if (!stage) return null;
  const p = stage.getPointerPosition();
  if (!p) return null;
  return {
    x: (p.x - stage.x()) / stage.scaleX(),
    y: (p.y - stage.y()) / stage.scaleY(),
  };
}

function mapApiElement(e: ApiElement): BlueprintElement {
  return {
    id: e.id,
    type: e.type,
    x: e.x,
    y: e.y,
    width: e.width ?? undefined,
    height: e.height ?? undefined,
    name: e.name ?? undefined,
    rotation: e.rotation ?? 0,
    linked_device_id: e.linked_device_id ?? undefined,
    assigned_zone_id: e.assigned_zone_id ?? undefined,
    device_kind: e.device_kind ?? undefined,
  };
}

function toApiPayload(elements: BlueprintElement[]) {
  return elements.map((el) => ({
    id: el.id,
    type: el.type,
    x: el.x,
    y: el.y,
    width: el.width ?? null,
    height: el.height ?? null,
    rotation: el.rotation ?? 0,
    name: el.name ?? null,
    linked_device_id: el.linked_device_id ?? null,
    assigned_zone_id: el.assigned_zone_id ?? null,
    device_kind: el.device_kind ?? null,
  }));
}

function nextRoomLabel(elements: BlueprintElement[]): string {
  const zones = elements.filter((z) => z.type === "zone");
  const n = zones.length + 1;
  return `Room ${n}`;
}

function DeviceGlyph({ kind, fill }: { kind: string; fill: string }) {
  const r = 16;
  switch (kind) {
    case "pump":
      return (
        <Group>
          <Circle radius={r} fill={fill} stroke="rgba(15,23,42,0.85)" strokeWidth={1.2} />
          <Rect x={-3} y={-r - 6} width={6} height={8} cornerRadius={1} fill="rgba(226,232,240,0.9)" />
        </Group>
      );
    case "tank":
      return (
        <Rect
          x={-r}
          y={-r + 2}
          width={r * 2}
          height={r * 2 - 4}
          cornerRadius={6}
          fill={fill}
          stroke="rgba(15,23,42,0.85)"
          strokeWidth={1.2}
        />
      );
    case "sensor":
      return (
        <Group>
          <Line points={[0, -r, r, r, -r, r, 0, -r]} closed fill={fill} stroke="rgba(15,23,42,0.85)" strokeWidth={1.2} />
        </Group>
      );
    default:
      return <Circle radius={r} fill={fill} stroke="rgba(15,23,42,0.85)" strokeWidth={1.2} />;
  }
}

export function BlueprintDesigner() {
  const [elements, setElements] = useState<BlueprintElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [placeKind, setPlaceKind] = useState<DeviceKind>("generic");
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [blueprintName, setBlueprintName] = useState("Untitled blueprint");
  const [list, setList] = useState<BlueprintSummary[]>([]);
  const [stageSize, setStageSize] = useState({ w: 800, h: 520 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [drawDraft, setDrawDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [zonesApi, setZonesApi] = useState<{ id: string; name: string }[]>([]);
  const [equipmentApi, setEquipmentApi] = useState<{ id: string; name: string }[]>([]);

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const selectedNodeRef = useRef<Konva.Node | null>(null);
  const drawOriginRef = useRef<{ x: number; y: number } | null>(null);
  const drawDraftRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const selected = elements.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    drawDraftRef.current = drawDraft;
  }, [drawDraft]);

  const refreshList = useCallback(async () => {
    try {
      const rows = await apiFetch<BlueprintSummary[]>("/api/blueprints");
      setList(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list blueprints");
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    const loadRefs = async () => {
      try {
        const [zones, equip] = await Promise.all([
          apiFetch<{ id: string; name: string }[]>("/api/v1/zones").catch(() => []),
          apiFetch<{ id: string; name: string }[]>("/api/v1/equipment").catch(() => []),
        ]);
        setZonesApi(zones);
        setEquipmentApi(equip);
      } catch {
        /* optional dropdowns */
      }
    };
    void loadRefs();
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const w = Math.max(320, Math.floor(r.width));
      const h = Math.max(380, Math.floor(r.height));
      setStageSize({ w, h });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setStageSize({ w: Math.max(320, Math.floor(r.width)), h: Math.max(380, Math.floor(r.height)) });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  useEffect(() => {
    if (!isPanning) return;
    const move = (e: MouseEvent) => {
      const last = panLastRef.current;
      if (!last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      panLastRef.current = { x: e.clientX, y: e.clientY };
      setStagePos((p) => ({ x: p.x + dx, y: p.y + dy }));
    };
    const up = () => {
      setIsPanning(false);
      panLastRef.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [isPanning]);

  const loadBlueprint = async (id: string) => {
    try {
      const d = await apiFetch<BlueprintDetail>(`/api/blueprints/${id}`);
      setBlueprintId(d.id);
      setBlueprintName(d.name);
      setElements(d.elements.map(mapApiElement));
      setSelectedId(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load blueprint");
    }
  };

  const saveBlueprint = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = { name: blueprintName.trim() || "Untitled blueprint", elements: toApiPayload(elements) };
      if (blueprintId) {
        const d = await apiFetch<BlueprintDetail>(`/api/blueprints/${blueprintId}`, {
          method: "PUT",
          json: payload,
        });
        setElements(d.elements.map(mapApiElement));
      } else {
        const d = await apiFetch<BlueprintDetail>("/api/blueprints", { method: "POST", json: payload });
        setBlueprintId(d.id);
        setElements(d.elements.map(mapApiElement));
      }
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const newBlueprint = () => {
    setBlueprintId(null);
    setBlueprintName("Untitled blueprint");
    setElements([]);
    setSelectedId(null);
    setTool("select");
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const scaleBy = 1.08;
    const oldScale = stageScale;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clamped = Math.max(0.12, Math.min(4.5, newScale));
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    const nextPos = {
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    };
    setStageScale(clamped);
    setStagePos(nextPos);
  };

  const startDraw = (x: number, y: number) => {
    drawOriginRef.current = { x, y };
    setDrawDraft({ x, y, w: 0, h: 0 });
  };

  const updateDraw = (x: number, y: number) => {
    const o = drawOriginRef.current;
    if (!o) return;
    const w = x - o.x;
    const h = y - o.y;
    setDrawDraft({ x: w < 0 ? x : o.x, y: h < 0 ? y : o.y, w: Math.abs(w), h: Math.abs(h) });
  };

  const finishDraw = () => {
    const o = drawOriginRef.current;
    const d = drawDraftRef.current;
    drawOriginRef.current = null;
    setDrawDraft(null);
    drawDraftRef.current = null;
    if (!o || !d || d.w < MIN_ZONE || d.h < MIN_ZONE) return;
    const id = crypto.randomUUID();
    setElements((prev) => [
      ...prev,
      {
        id,
        type: "zone",
        x: d.x,
        y: d.y,
        width: d.w,
        height: d.h,
        name: nextRoomLabel(prev),
        rotation: 0,
      },
    ]);
    setSelectedId(id);
    setTool("select");
  };

  const placeDeviceAt = (x: number, y: number) => {
    const id = crypto.randomUUID();
    const w = DEVICE_DEFAULT;
    const h = DEVICE_DEFAULT;
    setElements((prev) => [
      ...prev,
      {
        id,
        type: "device",
        x: x - w / 2,
        y: y - h / 2,
        width: w,
        height: h,
        name: placeKind.charAt(0).toUpperCase() + placeKind.slice(1),
        rotation: 0,
        device_kind: placeKind,
      },
    ]);
    setSelectedId(id);
    setTool("select");
  };

  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanning) return;
    const stage = e.target.getStage();
    if (!stage) return;
    if (e.evt.button === 2) {
      e.evt.preventDefault();
      setIsPanning(true);
      panLastRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }
    if (spaceDown && e.evt.button === 0) {
      e.evt.preventDefault();
      setIsPanning(true);
      panLastRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }
  };

  const onStageMouseMove = () => {
    if (tool !== "draw-room" || !drawOriginRef.current) return;
    const w = getWorldFromStage(stageRef.current);
    if (w) updateDraw(w.x, w.y);
  };

  const onStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === "draw-room" && e.evt.button === 0 && drawOriginRef.current) {
      finishDraw();
    }
  };

  const onPlaceOverlayClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    const w = getWorldFromStage(e.target.getStage());
    if (w) placeDeviceAt(w.x, w.y);
  };

  const onHitEmptyClick = () => {
    if (tool === "select") setSelectedId(null);
  };

  const syncTransformToState = (id: string, node: Konva.Node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const rotation = node.rotation();
    const x = node.x();
    const y = node.y();
    let width: number;
    let height: number;
    if (node.getClassName() === "Rect") {
      const r = node as Konva.Rect;
      width = Math.max(MIN_ZONE, r.width() * scaleX);
      height = Math.max(MIN_ZONE, r.height() * scaleY);
    } else {
      const g = node as Konva.Group;
      width = Math.max(20, g.width() * scaleX);
      height = Math.max(20, g.height() * scaleY);
    }
    setElements((prev) =>
      prev.map((el) =>
        el.id === id
          ? {
              ...el,
              x,
              y,
              width,
              height,
              rotation,
            }
          : el,
      ),
    );
  };

  useLayoutEffect(() => {
    if (!selectedId) selectedNodeRef.current = null;
  }, [selectedId]);

  useLayoutEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const n = selectedNodeRef.current;
    if (n && selectedId && tool === "select") {
      tr.nodes([n]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements, tool, stageSize.w, stageSize.h]);

  const gridLines = (() => {
    const { w, h } = stageSize;
    const minWX = (-stagePos.x) / stageScale;
    const maxWX = (w - stagePos.x) / stageScale;
    const minWY = (-stagePos.y) / stageScale;
    const maxWY = (h - stagePos.y) / stageScale;
    const pad = GRID * 3;
    const lines: React.ReactNode[] = [];
    const stroke = "rgba(148, 163, 184, 0.09)";
    const sw = 1 / stageScale;
    let k = 0;
    for (let x = Math.floor((minWX - pad) / GRID) * GRID; x <= maxWX + pad; x += GRID) {
      lines.push(
        <Line
          key={`v${k++}`}
          points={[x, minWY - pad, x, maxWY + pad]}
          stroke={stroke}
          strokeWidth={sw}
          listening={false}
        />,
      );
    }
    for (let y = Math.floor((minWY - pad) / GRID) * GRID; y <= maxWY + pad; y += GRID) {
      lines.push(
        <Line
          key={`h${k++}`}
          points={[minWX - pad, y, maxWX + pad, y]}
          stroke={stroke}
          strokeWidth={sw}
          listening={false}
        />,
      );
    }
    return lines;
  })();

  const updateSelectedField = (patch: Partial<BlueprintElement>) => {
    if (!selectedId) return;
    setElements((prev) => prev.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)));
  };

  return (
    <div className="bp-shell">
      <aside className="bp-sidebar" aria-label="Tools">
        <div>
          <h3>Tools</h3>
          <div className="bp-tool-grid">
            <button
              type="button"
              className={`bp-tool ${tool === "select" ? "is-active" : ""}`}
              onClick={() => setTool("select")}
            >
              Select
            </button>
            <button
              type="button"
              className={`bp-tool ${tool === "draw-room" ? "is-active" : ""}`}
              onClick={() => setTool("draw-room")}
            >
              Draw room
            </button>
            <button
              type="button"
              className={`bp-tool ${tool === "place-device" ? "is-active" : ""}`}
              onClick={() => setTool("place-device")}
            >
              Place device
            </button>
          </div>
        </div>
        <div>
          <h3>Device palette</h3>
          <div className="bp-palette">
            {(["pump", "tank", "sensor", "generic"] as DeviceKind[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`bp-chip ${placeKind === k ? "is-active" : ""}`}
                onClick={() => setPlaceKind(k)}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        <p className="bp-hint">
          Scroll to zoom (cursor-centered). Hold Space and drag or right-drag to pan. Draw rooms on empty grid.
        </p>
      </aside>

      <div className="bp-canvas-wrap">
        <div className="bp-toolbar">
          <span>
            <label htmlFor="bp-pick">Blueprint</label>
            <select
              id="bp-pick"
              value={blueprintId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) newBlueprint();
                else void loadBlueprint(v);
              }}
            >
              <option value="">— New —</option>
              {list.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </span>
          <span>
            <label htmlFor="bp-name">Name</label>
            <input
              id="bp-name"
              type="text"
              value={blueprintName}
              onChange={(e) => setBlueprintName(e.target.value)}
            />
          </span>
          <button type="button" className="bp-btn bp-btn--ghost" onClick={newBlueprint}>
            New
          </button>
          <button type="button" className="bp-btn" disabled={saving} onClick={() => void saveBlueprint()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {error ? (
          <p className="bp-error" style={{ margin: "0.5rem 0.75rem" }}>
            {error}
          </p>
        ) : null}
        <div
          ref={hostRef}
          className={`bp-stage-host ${spaceDown || isPanning ? "is-panning" : ""}`}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Stage
            width={stageSize.w}
            height={stageSize.h}
            ref={stageRef}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}
            onWheel={handleWheel}
            onMouseDown={onStageMouseDown}
            onMouseMove={onStageMouseMove}
            onMouseUp={onStageMouseUp}
          >
            <Layer>
              {gridLines}
              <Rect
                x={-8000}
                y={-8000}
                width={20000}
                height={20000}
                fill="rgba(15,23,42,0.01)"
                listening={tool === "select" || tool === "draw-room"}
                onClick={onHitEmptyClick}
                onMouseDown={(e) => {
                  if (tool === "draw-room" && e.evt.button === 0) {
                    e.cancelBubble = true;
                    const st = e.target.getStage();
                    const w = getWorldFromStage(st);
                    if (w) startDraw(w.x, w.y);
                  }
                }}
              />
              {elements
                .filter((el) => el.type === "zone")
                .map((el) => {
                  const w = el.width ?? 120;
                  const h = el.height ?? 80;
                  const sel = el.id === selectedId;
                  return (
                    <Group key={el.id}>
                      <Rect
                        ref={(node) => {
                          if (sel && tool === "select") selectedNodeRef.current = node;
                        }}
                        x={el.x}
                        y={el.y}
                        width={w}
                        height={h}
                        rotation={el.rotation ?? 0}
                        cornerRadius={6}
                        fill="rgba(148, 163, 184, 0.07)"
                        stroke="rgba(226, 232, 240, 0.42)"
                        strokeWidth={1.2 / stageScale}
                        shadowColor={sel ? "rgba(59, 130, 246, 0.45)" : "rgba(0,0,0,0.5)"}
                        shadowBlur={sel ? 18 : 10}
                        shadowOpacity={0.35}
                        shadowOffset={{ x: 0, y: 4 }}
                        listening={tool === "select"}
                        draggable={tool === "select"}
                        onMouseEnter={(e) => {
                          const t = e.target as unknown as { getClassName?: () => string; stroke?: (s: string) => void };
                          if (tool === "select" && !sel && t.getClassName?.() === "Rect")
                            t.stroke?.("rgba(226, 232, 240, 0.65)");
                        }}
                        onMouseLeave={(e) => {
                          const t = e.target as unknown as { getClassName?: () => string; stroke?: (s: string) => void };
                          if (t.getClassName?.() === "Rect") t.stroke?.("rgba(226, 232, 240, 0.42)");
                        }}
                        onClick={() => setSelectedId(el.id)}
                        onTap={() => setSelectedId(el.id)}
                        onDragEnd={(e) => {
                          setElements((prev) =>
                            prev.map((x) =>
                              x.id === el.id ? { ...x, x: e.target.x(), y: e.target.y() } : x,
                            ),
                          );
                        }}
                        onTransformEnd={(e) => syncTransformToState(el.id, e.target)}
                      />
                      <Text
                        text={(el.name ?? "ROOM").toUpperCase()}
                        x={el.x + 8}
                        y={el.y + 8}
                        fill="rgba(226, 232, 240, 0.82)"
                        fontSize={11}
                        fontFamily="ui-sans-serif, system-ui, sans-serif"
                        fontStyle="bold"
                        letterSpacing={1.2}
                        listening={false}
                      />
                    </Group>
                  );
                })}
              {elements
                .filter((el) => el.type === "device")
                .map((el) => {
                  const w = el.width ?? DEVICE_DEFAULT;
                  const h = el.height ?? DEVICE_DEFAULT;
                  const kind = el.device_kind ?? "generic";
                  const st = mockLinkStatus(el.linked_device_id);
                  const fill = STATUS_FILL[st];
                  const sel = el.id === selectedId;
                  return (
                    <Group
                      key={el.id}
                      ref={(node) => {
                        if (sel && tool === "select") selectedNodeRef.current = node;
                      }}
                      x={el.x}
                      y={el.y}
                      rotation={el.rotation ?? 0}
                      listening={tool === "select"}
                      draggable={tool === "select"}
                      onClick={() => setSelectedId(el.id)}
                      onTap={() => setSelectedId(el.id)}
                      onDragEnd={(e) => {
                        setElements((prev) =>
                          prev.map((x) => (x.id === el.id ? { ...x, x: e.target.x(), y: e.target.y() } : x)),
                        );
                      }}
                      onTransformEnd={(e) => syncTransformToState(el.id, e.target)}
                    >
                      <Rect
                        width={w}
                        height={h}
                        cornerRadius={10}
                        fill="rgba(30, 41, 59, 0.55)"
                        stroke="rgba(226, 232, 240, 0.2)"
                        strokeWidth={1 / stageScale}
                        shadowColor={sel ? "rgba(59, 130, 246, 0.5)" : "rgba(0,0,0,0.55)"}
                        shadowBlur={sel ? 16 : 8}
                        shadowOpacity={0.4}
                        shadowOffset={{ x: 0, y: 3 }}
                      />
                      <Group x={w / 2} y={h / 2} listening={false}>
                        <DeviceGlyph kind={kind} fill={fill} />
                      </Group>
                      <Text
                        text={(el.name ?? kind).toUpperCase()}
                        x={4}
                        y={h - 14}
                        fill="rgba(226, 232, 240, 0.75)"
                        fontSize={9}
                        fontFamily="ui-sans-serif, system-ui, sans-serif"
                        fontStyle="bold"
                        letterSpacing={0.8}
                        listening={false}
                      />
                    </Group>
                  );
                })}
              {drawDraft && drawDraft.w > 0 && drawDraft.h > 0 ? (
                <Rect
                  x={drawDraft.x}
                  y={drawDraft.y}
                  width={drawDraft.w}
                  height={drawDraft.h}
                  stroke="rgba(59, 130, 246, 0.65)"
                  strokeWidth={1.2 / stageScale}
                  fill="rgba(59, 130, 246, 0.08)"
                  listening={false}
                />
              ) : null}
              {tool === "place-device" ? (
                <Rect
                  x={-8000}
                  y={-8000}
                  width={20000}
                  height={20000}
                  fill="rgba(0,0,0,0.001)"
                  listening
                  onClick={onPlaceOverlayClick}
                />
              ) : null}
              <Transformer
                ref={transformerRef}
                rotateEnabled
                borderStroke="rgba(59, 130, 246, 0.65)"
                anchorStroke="rgba(148, 163, 184, 0.9)"
                anchorFill="#1e293b"
                anchorSize={8}
                padding={4}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < MIN_ZONE || newBox.height < MIN_ZONE) return oldBox;
                  return newBox;
                }}
              />
            </Layer>
          </Stage>
        </div>
      </div>

      <aside className="bp-props" aria-label="Properties">
        <h3 style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--bp-muted)" }}>
          Properties
        </h3>
        {!selected ? (
          <p className="bp-hint">Select a room or device, or use tools on the canvas.</p>
        ) : (
          <>
            <div className="bp-field">
              <label htmlFor="p-name">Name</label>
              <input
                id="p-name"
                value={selected.name ?? ""}
                onChange={(e) => updateSelectedField({ name: e.target.value })}
              />
            </div>
            <div className="bp-field">
              <label htmlFor="p-type">Type</label>
              <input id="p-type" readOnly value={selected.type === "zone" ? "Zone" : selected.device_kind ?? "device"} />
            </div>
            <div className="bp-field">
              <label>Position</label>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <input
                  type="number"
                  value={Math.round(selected.x)}
                  onChange={(e) => updateSelectedField({ x: Number(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  value={Math.round(selected.y)}
                  onChange={(e) => updateSelectedField({ y: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="bp-field">
              <label>Size</label>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <input
                  type="number"
                  value={Math.round(selected.width ?? 0)}
                  onChange={(e) => updateSelectedField({ width: Math.max(8, Number(e.target.value) || 0) })}
                />
                <input
                  type="number"
                  value={Math.round(selected.height ?? 0)}
                  onChange={(e) => updateSelectedField({ height: Math.max(8, Number(e.target.value) || 0) })}
                />
              </div>
            </div>
            {selected.type === "device" ? (
              <>
                <div className="bp-field">
                  <label htmlFor="p-link">Linked device</label>
                  <select
                    id="p-link"
                    value={selected.linked_device_id ?? ""}
                    onChange={(e) =>
                      updateSelectedField({
                        linked_device_id: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">— None —</option>
                    {equipmentApi.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bp-field">
                  <label htmlFor="p-zone">Zone assignment</label>
                  <select
                    id="p-zone"
                    value={selected.assigned_zone_id ?? ""}
                    onChange={(e) =>
                      updateSelectedField({
                        assigned_zone_id: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">— None —</option>
                    {zonesApi.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="bp-hint">
                  Status tint (mock): linked devices cycle neutral / normal / warning / alarm by id hash.
                </p>
              </>
            ) : null}
          </>
        )}
      </aside>
    </div>
  );
}
