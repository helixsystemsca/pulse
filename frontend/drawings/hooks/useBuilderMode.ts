"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BUILDER_MODE_STORAGE_KEY,
  MODES,
  type BuilderSemanticMode,
  type MapModeConfig,
  isBuilderSemanticMode,
} from "../mapBuilderModes";

function readStoredMode(): BuilderSemanticMode {
  if (typeof window === "undefined") return "telemetry";
  try {
    const raw = window.localStorage.getItem(BUILDER_MODE_STORAGE_KEY);
    if (isBuilderSemanticMode(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "telemetry";
}

export function useBuilderMode(): {
  activeMode: BuilderSemanticMode;
  setActiveMode: (m: BuilderSemanticMode) => void;
  modeConfig: MapModeConfig;
} {
  const [activeMode, setActiveModeState] = useState<BuilderSemanticMode>("telemetry");

  useEffect(() => {
    setActiveModeState(readStoredMode());
  }, []);

  const setActiveMode = useCallback((m: BuilderSemanticMode) => {
    setActiveModeState(m);
    try {
      window.localStorage.setItem(BUILDER_MODE_STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const modeConfig = MODES[activeMode];

  return { activeMode, setActiveMode, modeConfig };
}
