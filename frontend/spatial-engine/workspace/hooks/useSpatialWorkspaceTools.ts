"use client";

import { useEffect } from "react";
import type { SpatialWorkspaceToolEntry } from "@/spatial-engine/workspace/types";

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function hotkeyMatches(e: KeyboardEvent, tool: SpatialWorkspaceToolEntry): boolean {
  const hotkey = tool.hotkeys?.find((h) => h.key.toLowerCase() === e.key.toLowerCase());
  if (!hotkey) return false;
  const mods = hotkey.modifiers ?? [];
  const needCtrl = mods.includes("ctrl") || mods.includes("meta");
  const needShift = mods.includes("shift");
  const needAlt = mods.includes("alt");
  const ctrl = e.ctrlKey || e.metaKey;
  if (needCtrl !== ctrl) return false;
  if (needShift !== e.shiftKey) return false;
  if (needAlt !== e.altKey) return false;
  return true;
}

/** Registers workspace tool hotkeys from the tool registry. */
export function useSpatialWorkspaceTools(
  tools: readonly SpatialWorkspaceToolEntry[],
  onToolChange: (toolId: string) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      for (const tool of tools) {
        if (tool.disabled) continue;
        if (hotkeyMatches(e, tool)) {
          e.preventDefault();
          onToolChange(tool.id);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onToolChange, tools]);
}
