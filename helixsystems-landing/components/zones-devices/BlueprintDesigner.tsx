"use client";

import { animate, AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { apiFetch } from "@/lib/api";
import { bpDuration, bpEase, bpTransition } from "@/lib/motion-presets";
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

/** Subtle status accents (wireframe + soft fill) — not neon */
const STATUS_STROKE: Record<string, string> = {
  neutral: "rgba(203, 213, 245, 0.62)",
  normal: "rgba(34, 197, 94, 0.7)",
  warning: "rgba(250, 204, 21, 0.72)",
  alarm: "rgba(239, 68, 68, 0.68)",
};

const STATUS_SOFT_FILL: Record<string, string> = {
  neutral: "rgba(203, 213, 245, 0.05)",
  normal: "rgba(34, 197, 94, 0.07)",
  warning: "rgba(250, 204, 21, 0.08)",
  alarm: "rgba(239, 68, 68, 0.07)",
};

const ZONE_FACE_FILL = "rgba(248, 250, 252, 0.038)";
const ZONE_OUTLINE = "rgba(229, 231, 235, 0.9)";
const ZONE_OUTLINE_HOVER = "rgba(248, 250, 252, 0.98)";
const ZONE_RADIUS = 5;

function wallDropOffset(deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = 2.6 * Math.cos(rad) - 3.8 * Math.sin(rad);
  const dy = 2.6 * Math.sin(rad) + 3.8 * Math.cos(rad);
  return { dx, dy };
}

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

/** Minimal monochrome blueprint-style glyphs (stroke-forward). */
function DeviceGlyph({ kind, statusKey }: { kind: string; statusKey: string }) {
  const stroke = STATUS_STROKE[statusKey] ?? STATUS_STROKE.neutral;
  const soft = STATUS_SOFT_FILL[statusKey] ?? STATUS_SOFT_FILL.neutral;
  const swm = 1.35;
  const r = 14;

  switch (kind) {
    case "pump":
      return (
        <Group listening={false}>
          <Circle radius={r} fill={soft} stroke={stroke} strokeWidth={swm} />
          <Rect
            x={-2.5}
            y={-r - 7}
            width={5}
            height={7}
            cornerRadius={1}
            fill="transparent"
            stroke={stroke}
            strokeWidth={swm * 0.9}
          />
          <Line points={[-5, r * 0.35, 5, r * 0.35]} stroke={stroke} strokeWidth={swm * 0.85} listening={false} />
        </Group>
      );
    case "tank":
      return (
        <Rect
          x={-r}
          y={-r + 1}
          width={r * 2}
          height={r * 2 - 2}
          cornerRadius={5}
          fill={soft}
          stroke={stroke}
          strokeWidth={swm}
          listening={false}
        />
      );
    case "sensor":
      return (
        <Line
          points={[0, -r, r * 0.92, r * 0.55, -r * 0.92, r * 0.55]}
          closed
          fill={soft}
          stroke={stroke}
          strokeWidth={swm}
          lineJoin="round"
          listening={false}
        />
      );
    default:
      return <Circle radius={r} fill={soft} stroke={stroke} strokeWidth={swm} listening={false} />;
  }
}

/** Soft status glow behind device — Framer Motion loop; triggers one layer batch per frame (few devices). */
function DevicePulseHalo({
  cx,
  cy,
  mode,
  onFrame,
}: {
  cx: number;
  cy: number;
  mode: "alarm" | "warning";
  onFrame: () => void;
}) {
  const circleRef = useRef<Konva.Circle | null>(null);
  useEffect(() => {
    const c = circleRef.current;
    if (!c) return;
    const low = mode === "alarm" ? 0.07 : 0.04;
    const high = mode === "alarm" ? 0.26 : 0.19;
    const dur = mode === "alarm" ? 1.4 : 2.12;
    const ctrl = animate(low, high, {
      duration: dur,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
      onUpdate: (v) => {
        c.opacity(v);
        onFrame();
      },
    });
    return () => ctrl.stop();
  }, [mode, onFrame]);
  return (
    <Circle
      ref={circleRef}
      x={cx}
      y={cy}
      radius={mode === "alarm" ? 30 : 28}
      fill={mode === "alarm" ? "rgba(239, 68, 68, 0.18)" : "rgba(250, 204, 21, 0.14)"}
      listening={false}
    />
  );
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
  const layerRef = useRef<Konva.Layer | null>(null);
  const dragAnimRef = useRef<ReturnType<typeof animate> | null>(null);
  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);
  const [hoverDeviceId, setHoverDeviceId] = useState<string | null>(null);

  const batchLayer = useCallback(() => {
    layerRef.current?.batchDraw();
  }, []);

  useEffect(() => {
    setHoverZoneId(null);
    setHoverDeviceId(null);
  }, [tool]);

  const runDragScale = useCallback((node: Konva.Node, to: number) => {
    dragAnimRef.current?.stop();
    const from = node.scaleX();
    if (Math.abs(from - to) < 0.002) return;
    dragAnimRef.current = animate(from, to, {
      duration: bpDuration.med,
      ease: bpEase,
      onUpdate: (v) => {
        node.scaleX(v);
        node.scaleY(v);
        layerRef.current?.batchDraw();
      },
    });
  }, []);

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
    const stroke = "rgba(148, 163, 184, 0.042)";
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
      <motion.aside
        className="bp-sidebar"
        aria-label="Tools"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={bpTransition.med}
      >
        <div>
          <h3>Tools</h3>
          <div className="bp-tool-grid">
            <motion.button
              type="button"
              className={`bp-tool ${tool === "select" ? "is-active" : ""}`}
              onClick={() => setTool("select")}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 22px rgba(0, 0, 0, 0.16)" }}
              whileTap={{ scale: 0.985 }}
              transition={bpTransition.fast}
            >
              Select
            </motion.button>
            <motion.button
              type="button"
              className={`bp-tool ${tool === "draw-room" ? "is-active" : ""}`}
              onClick={() => setTool("draw-room")}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 22px rgba(0, 0, 0, 0.16)" }}
              whileTap={{ scale: 0.985 }}
              transition={bpTransition.fast}
            >
              Draw room
            </motion.button>
            <motion.button
              type="button"
              className={`bp-tool ${tool === "place-device" ? "is-active" : ""}`}
              onClick={() => setTool("place-device")}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 22px rgba(0, 0, 0, 0.16)" }}
              whileTap={{ scale: 0.985 }}
              transition={bpTransition.fast}
            >
              Place device
            </motion.button>
          </div>
        </div>
        <div>
          <h3>Device palette</h3>
          <div className="bp-palette">
            {(["pump", "tank", "sensor", "generic"] as DeviceKind[]).map((k) => (
              <motion.button
                key={k}
                type="button"
                className={`bp-chip ${placeKind === k ? "is-active" : ""}`}
                onClick={() => setPlaceKind(k)}
                whileHover={{ scale: 1.02, y: -1, boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)" }}
                whileTap={{ scale: 0.98 }}
                transition={bpTransition.fast}
              >
                {k}
              </motion.button>
            ))}
          </div>
        </div>
        <p className="bp-hint">
          Scroll to zoom (cursor-centered). Hold Space and drag or right-drag to pan. Draw rooms on empty grid.
        </p>
      </motion.aside>

      <motion.div
        className="bp-canvas-wrap"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...bpTransition.med, delay: 0.02 }}
      >
        <motion.div
          className="bp-toolbar"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...bpTransition.fast, delay: 0.05 }}
        >
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
          <motion.button
            type="button"
            className="bp-btn bp-btn--ghost"
            onClick={newBlueprint}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.985 }}
            transition={bpTransition.fast}
          >
            New
          </motion.button>
          <motion.button
            type="button"
            className="bp-btn"
            disabled={saving}
            onClick={() => void saveBlueprint()}
            whileHover={saving ? undefined : { scale: 1.02, boxShadow: "0 8px 24px rgba(59, 130, 246, 0.2)" }}
            whileTap={saving ? undefined : { scale: 0.985 }}
            transition={bpTransition.fast}
          >
            {saving ? "Saving…" : "Save"}
          </motion.button>
        </motion.div>
        <AnimatePresence>
          {error ? (
            <motion.p
              key={error}
              className="bp-error"
              style={{ margin: "0.5rem 0.75rem" }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={bpTransition.med}
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
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
            <Layer ref={layerRef}>
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
                  const rot = el.rotation ?? 0;
                  const { dx, dy } = wallDropOffset(rot);
                  const sw = Math.max(0.75, 1.22 / stageScale);
                  const ins = Math.max(0.6, 1.05 / stageScale);
                  const labelSize = Math.min(11, Math.max(9, Math.min(w, h) / 7));
                  const zGlow = tool === "select" && !sel && hoverZoneId === el.id;
                  return (
                    <Group key={el.id}>
                      {/* Elevation mass — offset duplicate (under room face) */}
                      <Rect
                        x={el.x + dx}
                        y={el.y + dy}
                        width={w}
                        height={h}
                        rotation={rot}
                        cornerRadius={ZONE_RADIUS}
                        fill="rgba(3, 7, 18, 0.62)"
                        listening={false}
                        opacity={0.85}
                        shadowColor="rgba(0, 0, 0, 0.55)"
                        shadowBlur={10}
                        shadowOpacity={0.22}
                        shadowOffset={{ x: 0, y: 1 }}
                      />
                      {/* Top / left highlight & bottom / right shade (architectural bevel) */}
                      <Group x={el.x} y={el.y} rotation={rot} listening={false}>
                        <Line
                          points={[ins, ins, w - ins, ins]}
                          stroke="rgba(248, 250, 252, 0.34)"
                          strokeWidth={sw * 0.88}
                          lineCap="round"
                          listening={false}
                        />
                        <Line
                          points={[ins, ins, ins, h - ins]}
                          stroke="rgba(248, 250, 252, 0.28)"
                          strokeWidth={sw * 0.88}
                          lineCap="round"
                          listening={false}
                        />
                        <Line
                          points={[ins, h - ins, w - ins, h - ins]}
                          stroke="rgba(2, 6, 18, 0.45)"
                          strokeWidth={sw}
                          lineCap="round"
                          listening={false}
                        />
                        <Line
                          points={[w - ins, ins, w - ins, h - ins]}
                          stroke="rgba(2, 6, 18, 0.48)"
                          strokeWidth={sw}
                          lineCap="round"
                          listening={false}
                        />
                      </Group>
                      <Rect
                        ref={(node) => {
                          if (sel && tool === "select") selectedNodeRef.current = node;
                        }}
                        x={el.x}
                        y={el.y}
                        width={w}
                        height={h}
                        rotation={rot}
                        cornerRadius={ZONE_RADIUS}
                        fill={ZONE_FACE_FILL}
                        stroke={ZONE_OUTLINE}
                        strokeWidth={sw}
                        shadowColor={
                          sel ? "rgba(59, 130, 246, 0.42)" : zGlow ? "rgba(96, 165, 250, 0.32)" : "rgba(0, 0, 0, 0.2)"
                        }
                        shadowBlur={sel ? 18 : zGlow ? 12 : 6}
                        shadowOpacity={sel ? 0.34 : zGlow ? 0.18 : 0.12}
                        shadowOffset={{ x: 0, y: sel ? 0 : 2 }}
                        listening={tool === "select"}
                        draggable={tool === "select"}
                        onMouseEnter={(e) => {
                          if (tool === "select" && !sel) setHoverZoneId(el.id);
                          const t = e.target as unknown as { getClassName?: () => string; stroke?: (s: string) => void };
                          if (tool === "select" && !sel && t.getClassName?.() === "Rect") t.stroke?.(ZONE_OUTLINE_HOVER);
                        }}
                        onMouseLeave={(e) => {
                          setHoverZoneId((z) => (z === el.id ? null : z));
                          const t = e.target as unknown as { getClassName?: () => string; stroke?: (s: string) => void };
                          if (t.getClassName?.() === "Rect") t.stroke?.(ZONE_OUTLINE);
                        }}
                        onClick={() => setSelectedId(el.id)}
                        onTap={() => setSelectedId(el.id)}
                        onDragStart={(e) => {
                          if (tool === "select") runDragScale(e.target, 1.02);
                        }}
                        onDragEnd={(e) => {
                          const node = e.target;
                          const nx = node.x();
                          const ny = node.y();
                          runDragScale(node, 1);
                          setElements((prev) =>
                            prev.map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x)),
                          );
                        }}
                        onTransformEnd={(e) => syncTransformToState(el.id, e.target)}
                      />
                      <Text
                        text={(el.name ?? "ROOM").toUpperCase()}
                        x={el.x}
                        y={el.y}
                        width={w}
                        height={h}
                        rotation={rot}
                        align="center"
                        verticalAlign="middle"
                        fill="#cbd5f5"
                        opacity={0.94}
                        fontSize={labelSize}
                        fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
                        fontStyle="normal"
                        letterSpacing={2}
                        listening={false}
                        wrap="none"
                        ellipsis
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
                  const sel = el.id === selectedId;
                  const dStroke = Math.max(0.65, 0.92 / stageScale);
                  const dGlow = tool === "select" && !sel && hoverDeviceId === el.id;
                  const pulse = st === "alarm" || st === "warning";
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
                      shadowColor={
                        sel ? "rgba(59, 130, 246, 0.42)" : dGlow ? "rgba(96, 165, 250, 0.3)" : "rgba(0, 0, 0, 0.55)"
                      }
                      shadowBlur={sel ? 19 : dGlow ? 14 : 11}
                      shadowOpacity={0.24}
                      shadowOffset={{ x: 0, y: 5 }}
                      onClick={() => setSelectedId(el.id)}
                      onTap={() => setSelectedId(el.id)}
                      onDragStart={(e) => {
                        if (tool === "select") runDragScale(e.target, 1.02);
                      }}
                      onDragEnd={(e) => {
                        const node = e.target;
                        const nx = node.x();
                        const ny = node.y();
                        runDragScale(node, 1);
                        setElements((prev) =>
                          prev.map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x)),
                        );
                      }}
                      onTransformEnd={(e) => syncTransformToState(el.id, e.target)}
                      onMouseEnter={(e) => {
                        if (tool === "select" && !sel) setHoverDeviceId(el.id);
                        if (tool !== "select" || sel) return;
                        e.currentTarget.opacity(1);
                      }}
                      onMouseLeave={(e) => {
                        setHoverDeviceId((z) => (z === el.id ? null : z));
                        e.currentTarget.opacity(sel ? 1 : 0.97);
                      }}
                      opacity={0.97}
                    >
                      {pulse ? (
                        <DevicePulseHalo
                          cx={w / 2}
                          cy={h / 2}
                          mode={st === "alarm" ? "alarm" : "warning"}
                          onFrame={batchLayer}
                        />
                      ) : null}
                      <Rect
                        width={w}
                        height={h}
                        cornerRadius={10}
                        fill="rgba(15, 23, 42, 0.18)"
                        stroke={
                          sel
                            ? "rgba(96, 165, 250, 0.45)"
                            : dGlow
                              ? "rgba(203, 213, 245, 0.28)"
                              : "rgba(203, 213, 245, 0.16)"
                        }
                        strokeWidth={dStroke}
                        listening={false}
                      />
                      <Group opacity={dGlow ? 1 : 0.94} x={w / 2} y={h / 2} listening={false}>
                        <DeviceGlyph kind={kind} statusKey={st} />
                      </Group>
                      <Text
                        text={(el.name ?? kind).toUpperCase()}
                        x={4}
                        y={h - 13}
                        width={w - 8}
                        align="center"
                        fill="#cbd5f5"
                        opacity={0.88}
                        fontSize={9}
                        fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
                        fontStyle="normal"
                        letterSpacing={1.4}
                        listening={false}
                        ellipsis
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
                  cornerRadius={ZONE_RADIUS}
                  stroke="rgba(96, 165, 250, 0.55)"
                  strokeWidth={Math.max(0.85, 1.1 / stageScale)}
                  fill="rgba(148, 197, 255, 0.05)"
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
                borderStroke="rgba(96, 165, 250, 0.55)"
                borderDash={[5, 4]}
                anchorStroke="rgba(203, 213, 245, 0.55)"
                anchorFill="rgba(15, 23, 42, 0.95)"
                anchorSize={9}
                padding={5}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < MIN_ZONE || newBox.height < MIN_ZONE) return oldBox;
                  return newBox;
                }}
              />
            </Layer>
          </Stage>
        </div>
      </motion.div>

      <motion.aside
        className="bp-props"
        aria-label="Properties"
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...bpTransition.med, delay: 0.04 }}
      >
        <h3 style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--bp-muted)" }}>
          Properties
        </h3>
        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.p
              key="props-empty"
              className="bp-hint"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={bpTransition.med}
            >
              Select a room or device, or use tools on the canvas.
            </motion.p>
          ) : (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={bpTransition.med}
              style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </div>
  );
}
