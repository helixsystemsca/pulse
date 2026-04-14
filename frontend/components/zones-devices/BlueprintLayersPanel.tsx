"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BlueprintLayer } from "./blueprint-types";

type Props = {
  layers: BlueprintLayer[];
  activeLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
  onRenameLayer: (id: string, name: string) => void;
  disabled: boolean;
};

export function BlueprintLayersPanel({
  layers,
  activeLayerId,
  onSelectLayer,
  onAddLayer,
  onDeleteLayer,
  onReorderLayers,
  onRenameLayer,
  disabled,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingId) return;
    const t = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(t);
  }, [editingId]);

  const beginRename = useCallback((L: BlueprintLayer) => {
    if (disabled) return;
    setEditingId(L.id);
    setDraftName(L.name);
  }, [disabled]);

  const commitRename = useCallback(() => {
    if (!editingId) return;
    const trimmed = draftName.trim();
    if (trimmed) onRenameLayer(editingId, trimmed.slice(0, 120));
    setEditingId(null);
  }, [draftName, editingId, onRenameLayer]);

  return (
    <div className={`bp-layers${disabled ? " bp-layers--disabled" : ""}`}>
      <h3>Layers</h3>
      <p className="bp-hint" style={{ margin: 0 }}>
        Top of the list is drawn on top. New geometry uses the highlighted layer.
      </p>
      <div className="bp-layers__actions">
        <button type="button" className="bp-btn bp-btn--ghost" disabled={disabled} onClick={onAddLayer}>
          + New layer
        </button>
      </div>
      <ul className="bp-layers__list" aria-label="Blueprint layers">
        {layers.map((L, index) => {
          const active = activeLayerId === L.id;
          const isEditing = editingId === L.id;
          return (
            <li
              key={L.id}
              className={`bp-layers__row${active ? " is-active" : ""}${dragFrom === index ? " is-dragging" : ""}`}
              draggable={!disabled && !isEditing}
              onDragStart={() => {
                if (disabled || isEditing) return;
                setDragFrom(index);
              }}
              onDragEnd={() => setDragFrom(null)}
              onDragOver={(e) => {
                if (disabled || dragFrom === null) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (disabled || dragFrom === null) return;
                if (dragFrom !== index) onReorderLayers(dragFrom, index);
                setDragFrom(null);
              }}
            >
              <button
                type="button"
                className="bp-layers__select"
                disabled={disabled}
                onClick={() => onSelectLayer(L.id)}
                title="Use this layer for new elements"
              >
                {isEditing ? (
                  <input
                    ref={inputRef}
                    className="bp-layers__rename-input"
                    value={draftName}
                    maxLength={120}
                    disabled={disabled}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingId(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="bp-layers__name"
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      beginRename(L);
                    }}
                  >
                    {L.name || "Untitled"}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="bp-layers__delete"
                disabled={disabled || layers.length <= 1}
                title={layers.length <= 1 ? "Keep at least one layer" : "Delete layer"}
                aria-label={`Delete layer ${L.name}`}
                onClick={() => onDeleteLayer(L.id)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
