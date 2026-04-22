"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  computeCoverageGridStats,
  computeGapPointMarkers,
} from "./iot-coverage-math";
import {
  DEFAULT_DEVICE_RANGE_M,
  type Device,
  type DeviceType,
  type IotTool,
  IOT_DEFAULT_METERS_PER_PIXEL,
} from "./iot-deployment-types";

const GRID_SNAP = 32;

export function useIotDeploymentPlanner() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [metersPerPixel, setMetersPerPixel] = useState<number | null>(null);
  const [coverageEnabled, setCoverageEnabled] = useState(false);
  const [showGaps, setShowGaps] = useState(true);
  const [iotTool, setIotTool] = useState<IotTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [snapGrid, setSnapGrid] = useState(false);

  const [scaleP1, setScaleP1] = useState<{ x: number; y: number } | null>(null);
  const [scaleP2, setScaleP2] = useState<{ x: number; y: number } | null>(null);
  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const [scalePixelDistance, setScalePixelDistance] = useState(0);
  /** Synchronous for modal confirm; avoids stale `scalePixelDistance` in a batched update. */
  const scalePixelDistanceRef = useRef(0);

  const effectiveMpp = metersPerPixel ?? IOT_DEFAULT_METERS_PER_PIXEL;

  const snapWorld = useCallback(
    (x: number, y: number) => {
      if (!snapGrid) return { x, y };
      return {
        x: Math.round(x / GRID_SNAP) * GRID_SNAP,
        y: Math.round(y / GRID_SNAP) * GRID_SNAP,
      };
    },
    [snapGrid],
  );

  const addDeviceAt = useCallback(
    (type: DeviceType, x: number, y: number) => {
      const p = snapWorld(x, y);
      const id = crypto.randomUUID();
      const range = DEFAULT_DEVICE_RANGE_M[type];
      setDevices((prev) => [...prev, { id, type, x: p.x, y: p.y, rangeMeters: range }]);
      setSelectedId(id);
    },
    [snapWorld],
  );

  const updateDevice = useCallback((id: string, patch: Partial<Device>) => {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const removeDevice = useCallback((id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const clearSelection = useCallback(() => setSelectedId(null), []);

  const onDeviceDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      const p = snapWorld(x, y);
      updateDevice(id, { x: p.x, y: p.y });
    },
    [snapWorld, updateDevice],
  );

  const coverageStats = useMemo(
    () => computeCoverageGridStats(devices, effectiveMpp, { step: 25 }),
    [devices, effectiveMpp],
  );

  const gapPoints = useMemo(() => {
    if (!coverageEnabled || !showGaps || devices.length === 0) return [];
    return computeGapPointMarkers(devices, effectiveMpp, 25);
  }, [coverageEnabled, showGaps, devices, effectiveMpp]);

  const beginScalePoint = useCallback((x: number, y: number) => {
    const p = snapWorld(x, y);
    if (!scaleP1) {
      setScaleP1(p);
      setScaleP2(null);
      return;
    }
    const d = Math.hypot(p.x - scaleP1.x, p.y - scaleP1.y);
    if (d < 3) return;
    setScaleP2(p);
    scalePixelDistanceRef.current = d;
    setScalePixelDistance(d);
    setScaleModalOpen(true);
  }, [scaleP1, snapWorld]);

  const confirmScaleMeters = useCallback(
    (meters: number) => {
      const d = scalePixelDistanceRef.current;
      if (!scaleP1 || !scaleP2 || d <= 0 || !(meters > 0)) return;
      setMetersPerPixel(meters / d);
      setScaleModalOpen(false);
      setScaleP1(null);
      setScaleP2(null);
      setIotTool("select");
    },
    [scaleP1, scaleP2],
  );

  const cancelScale = useCallback(() => {
    setScaleModalOpen(false);
    setScaleP1(null);
    setScaleP2(null);
  }, []);

  const suggestion =
    coverageStats.uncoveredCells > 12 && devices.length > 0
      ? "Add a node or gateway toward the red gap areas to improve coverage."
      : devices.length === 0
        ? "Place gateways and nodes, then enable coverage to preview range."
        : null;

  return {
    devices,
    setDevices,
    metersPerPixel,
    setMetersPerPixel,
    effectiveMpp,
    coverageEnabled,
    setCoverageEnabled,
    showGaps,
    setShowGaps,
    iotTool,
    setIotTool,
    selectedId,
    setSelectedId,
    hoveredId,
    setHoveredId,
    snapGrid,
    setSnapGrid,
    clearSelection,
    onDeviceDragEnd,
    addDeviceAt,
    updateDevice,
    removeDevice,
    coverageStats,
    gapPoints,
    scaleP1,
    scaleP2,
    scaleModalOpen,
    setScaleModalOpen,
    scalePixelDistance,
    beginScalePoint,
    confirmScaleMeters,
    cancelScale,
    suggestion,
  };
}

export type IotDeploymentPlanner = ReturnType<typeof useIotDeploymentPlanner>;
