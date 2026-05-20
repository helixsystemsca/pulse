import { deserializeSpatialDocument, serializeSpatialDocument } from "@/spatial-engine/document/serialization";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import type {
  SpatialHistoryEvent,
  SpatialHistoryListener,
  SpatialRevisionSnapshot,
  SpatialRevisionStackOptions,
  UndoRedoState,
} from "@/spatial-engine/intelligence/history/types";

function newSnapshotId(): string {
  return `rev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneDocument(doc: SpatialDocument): SpatialDocument {
  return deserializeSpatialDocument(serializeSpatialDocument(doc));
}

export function createRevisionSnapshot(doc: SpatialDocument, label?: string): SpatialRevisionSnapshot {
  return {
    id: newSnapshotId(),
    label,
    createdAt: new Date().toISOString(),
    documentJson: serializeSpatialDocument(doc),
  };
}

export function restoreRevisionSnapshot(snapshot: SpatialRevisionSnapshot): SpatialDocument {
  return deserializeSpatialDocument(snapshot.documentJson);
}

/**
 * Undo/redo stack over canonical `SpatialDocument` snapshots.
 * Host apps push after discrete edits; engine never mutates domain page state directly.
 */
export class SpatialRevisionStack {
  private undoStack: SpatialRevisionSnapshot[] = [];
  private redoStack: SpatialRevisionSnapshot[] = [];
  private readonly maxDepth: number;
  private listeners = new Set<SpatialHistoryListener>();

  constructor(options: SpatialRevisionStackOptions = {}) {
    this.maxDepth = Math.max(1, options.maxDepth ?? 50);
  }

  subscribe(listener: SpatialHistoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SpatialHistoryEvent): void {
    const state = this.getState();
    for (const l of this.listeners) l(event, state);
  }

  getState(): UndoRedoState {
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoDepth: this.undoStack.length,
      redoDepth: this.redoStack.length,
    };
  }

  /** Record current document before a mutation (call before applying edit). */
  push(doc: SpatialDocument, label?: string): void {
    const snap = createRevisionSnapshot(cloneDocument(doc), label);
    this.undoStack.push(snap);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.emit({ type: "push", snapshotId: snap.id });
  }

  /** Replace stacks with a single baseline (e.g. after load). */
  resetBaseline(doc: SpatialDocument, label = "baseline"): void {
    this.undoStack = [createRevisionSnapshot(cloneDocument(doc), label)];
    this.redoStack = [];
    this.emit({ type: "clear" });
  }

  undo(current: SpatialDocument): SpatialDocument | null {
    if (this.undoStack.length === 0) return null;
    const currentSnap = createRevisionSnapshot(cloneDocument(current));
    this.redoStack.push(currentSnap);
    const prev = this.undoStack.pop()!;
    const restored = restoreRevisionSnapshot(prev);
    this.emit({ type: "undo", snapshotId: prev.id });
    return restored;
  }

  redo(current: SpatialDocument): SpatialDocument | null {
    if (this.redoStack.length === 0) return null;
    const currentSnap = createRevisionSnapshot(cloneDocument(current));
    this.undoStack.push(currentSnap);
    const next = this.redoStack.pop()!;
    const restored = restoreRevisionSnapshot(next);
    this.emit({ type: "redo", snapshotId: next.id });
    return restored;
  }

  listSnapshots(): readonly SpatialRevisionSnapshot[] {
    return [...this.undoStack];
  }
}
