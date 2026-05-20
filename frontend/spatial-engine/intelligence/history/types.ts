import type { SpatialDocument } from "@/spatial-engine/document/types";

/** Immutable canonical snapshot — serialized document only, no runtime/Konva state. */
export type SpatialRevisionSnapshot = {
  id: string;
  label?: string;
  createdAt: string;
  /** Result of `serializeSpatialDocument` for deterministic restore. */
  documentJson: string;
};

export type SpatialRevisionStackOptions = {
  maxDepth?: number;
};

export type UndoRedoState = {
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
};

export type SpatialHistoryEvent =
  | { type: "push"; snapshotId: string }
  | { type: "undo"; snapshotId: string }
  | { type: "redo"; snapshotId: string }
  | { type: "clear" };

export type SpatialHistoryListener = (event: SpatialHistoryEvent, state: UndoRedoState) => void;
