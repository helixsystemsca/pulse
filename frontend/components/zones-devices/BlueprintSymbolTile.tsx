"use client";

import type { SymbolLibraryId } from "./blueprint-symbols-shared";
import { BlueprintSymbolPreview } from "./BlueprintSymbolPreview";

export function BlueprintSymbolTile({
  symbolId,
  label,
  isActive,
  onPick,
}: {
  symbolId: SymbolLibraryId;
  label: string;
  isActive: boolean;
  onPick: (id: SymbolLibraryId) => void;
}) {
  return (
    <button
      type="button"
      className={`bp-symbol-tile${isActive ? " is-active" : ""}`}
      onClick={() => onPick(symbolId)}
      aria-pressed={isActive}
    >
      <span className="bp-symbol-tile__icon">
        <BlueprintSymbolPreview symbolType={symbolId} size={40} />
      </span>
      <span className="bp-symbol-tile__label">{label}</span>
    </button>
  );
}
