import {
  createRevisionSnapshot,
  restoreRevisionSnapshot,
  type SpatialRevisionSnapshot,
} from "@/spatial-engine/intelligence/history";
import type { SpatialDocument } from "@/spatial-engine/document/types";

/** Named restore point with audit metadata (extends revision snapshots). */
export type SpatialNamedSnapshot = SpatialRevisionSnapshot & {
  /** User-facing label for restore UI. */
  name: string;
  /** `manual` | `autosave` | `publish` | `import` */
  source: "manual" | "autosave" | "publish" | "import";
  createdBy?: string;
  /** Optional audit note. */
  note?: string;
};

export type SpatialSnapshotAuditEntry = {
  id: string;
  snapshotId: string;
  action: "create" | "restore" | "delete";
  at: string;
  actorId?: string;
  label?: string;
};

export function createNamedSnapshot(
  doc: SpatialDocument,
  opts: {
    name: string;
    source?: SpatialNamedSnapshot["source"];
    createdBy?: string;
    note?: string;
    label?: string;
  },
): SpatialNamedSnapshot {
  const base = createRevisionSnapshot(doc, opts.label ?? opts.name);
  return {
    ...base,
    name: opts.name,
    source: opts.source ?? "manual",
    createdBy: opts.createdBy,
    note: opts.note,
  };
}

export function restoreNamedSnapshot(snapshot: SpatialNamedSnapshot): SpatialDocument {
  return restoreRevisionSnapshot(snapshot);
}

/** In-memory named snapshot registry per document (host persists to API when ready). */
export class SpatialSnapshotRegistry {
  private snapshots = new Map<string, SpatialNamedSnapshot[]>();
  private audit: SpatialSnapshotAuditEntry[] = [];

  list(documentId: string): SpatialNamedSnapshot[] {
    return [...(this.snapshots.get(documentId) ?? [])];
  }

  getAudit(documentId?: string): SpatialSnapshotAuditEntry[] {
    if (!documentId) return [...this.audit];
    return this.audit.filter((e) => {
      const snaps = this.snapshots.get(documentId) ?? [];
      return snaps.some((s) => s.id === e.snapshotId);
    });
  }

  save(doc: SpatialDocument, opts: Parameters<typeof createNamedSnapshot>[1]): SpatialNamedSnapshot {
    const snap = createNamedSnapshot(doc, opts);
    const list = this.snapshots.get(doc.id) ?? [];
    this.snapshots.set(doc.id, [snap, ...list].slice(0, 100));
    this.audit.push({
      id: `audit-${Date.now()}`,
      snapshotId: snap.id,
      action: "create",
      at: snap.createdAt,
      actorId: opts.createdBy,
      label: opts.name,
    });
    return snap;
  }

  restore(documentId: string, snapshotId: string): SpatialDocument | null {
    const snap = (this.snapshots.get(documentId) ?? []).find((s) => s.id === snapshotId);
    if (!snap) return null;
    this.audit.push({
      id: `audit-${Date.now()}`,
      snapshotId,
      action: "restore",
      at: new Date().toISOString(),
      label: snap.name,
    });
    return restoreNamedSnapshot(snap);
  }

  remove(documentId: string, snapshotId: string): boolean {
    const list = this.snapshots.get(documentId) ?? [];
    const next = list.filter((s) => s.id !== snapshotId);
    if (next.length === list.length) return false;
    this.snapshots.set(documentId, next);
    this.audit.push({
      id: `audit-${Date.now()}`,
      snapshotId,
      action: "delete",
      at: new Date().toISOString(),
    });
    return true;
  }
}
