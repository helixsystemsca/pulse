"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import type { SpatialWorkspaceKind } from "@/spatial-engine/document/types";
import { SpatialRevisionStack } from "@/spatial-engine/intelligence/history";
import { EMPTY_SPATIAL_SELECTION, type SpatialSelectionState } from "@/spatial-engine/selection/types";
import type { SpatialViewport } from "@/spatial-engine/types/spatial";
import {
  DEFAULT_OPERATIONAL_LAYER_TOGGLES,
  type SpatialOperationalLayerToggles,
  type SpatialOperationalOverlay,
} from "@/spatial-engine/operations/types";
import { createEmptyCollaborationBundle } from "@/spatial-engine/operations/collaboration";
import { SpatialSnapshotRegistry } from "@/spatial-engine/operations/snapshots";
import {
  DEFAULT_SPATIAL_VIEWPORT,
  type SpatialRuntimeDocumentEntry,
  type SpatialRuntimeSession,
} from "@/spatial-engine/runtime/types";

export type SpatialRuntimeStoreState = {
  documents: Record<string, SpatialRuntimeDocumentEntry>;
  session: SpatialRuntimeSession;
  revisionStack: SpatialRevisionStack;
  snapshotRegistry: SpatialSnapshotRegistry;
};

export type SpatialRuntimeStoreActions = {
  resetSession: (workspaceId: SpatialWorkspaceKind) => void;
  loadDocument: (doc: SpatialDocument, opts?: { pushHistory?: boolean; label?: string }) => void;
  unloadDocument: (documentId: string) => void;
  setActiveDocumentId: (id: string | null) => void;
  /** Replace active document (or by id) — canonical mutation entry point. */
  updateDocument: (
    documentId: string,
    updater: (doc: SpatialDocument) => SpatialDocument,
    opts?: { pushHistory?: boolean; label?: string },
  ) => void;
  updateActiveDocument: (
    updater: (doc: SpatialDocument) => SpatialDocument,
    opts?: { pushHistory?: boolean; label?: string },
  ) => void;
  setSelection: (selection: SpatialSelectionState) => void;
  setViewport: (viewport: SpatialViewport) => void;
  patchViewport: (patch: Partial<SpatialViewport>) => void;
  setActiveToolId: (toolId: string) => void;
  setToolState: (patch: Record<string, unknown>) => void;
  clearToolState: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: (label?: string) => void;
  setOperationalOverlays: (overlays: SpatialOperationalOverlay[]) => void;
  setOperationalLayerToggles: (toggles: Partial<SpatialOperationalLayerToggles>) => void;
  setOverlayVisible: (overlayId: string, visible: boolean) => void;
};

function bumpEntry(doc: SpatialDocument, prev?: SpatialRuntimeDocumentEntry): SpatialRuntimeDocumentEntry {
  return { document: doc, revision: (prev?.revision ?? 0) + 1 };
}

const initialSession = (workspaceId: SpatialWorkspaceKind = "infrastructure"): SpatialRuntimeSession => ({
  workspaceId,
  activeDocumentId: null,
  selection: EMPTY_SPATIAL_SELECTION,
  viewport: { ...DEFAULT_SPATIAL_VIEWPORT },
  activeToolId: "select",
  toolState: {},
  operationalOverlays: [],
  operationalLayerToggles: { ...DEFAULT_OPERATIONAL_LAYER_TOGGLES },
  overlayVisibility: {},
  collaboration: createEmptyCollaborationBundle(),
});

export const useSpatialRuntimeStore = create<SpatialRuntimeStoreState & SpatialRuntimeStoreActions>()(
  subscribeWithSelector((set, get) => ({
    documents: {},
    session: initialSession(),
    revisionStack: new SpatialRevisionStack({ maxDepth: 50 }),
    snapshotRegistry: new SpatialSnapshotRegistry(),

    resetSession: (workspaceId) => {
      set({
        documents: {},
        session: initialSession(workspaceId),
        revisionStack: new SpatialRevisionStack({ maxDepth: 50 }),
        snapshotRegistry: new SpatialSnapshotRegistry(),
      });
    },

    loadDocument: (doc, opts) => {
      const pushHistory = opts?.pushHistory ?? true;
      const { revisionStack } = get();
      if (pushHistory) revisionStack.resetBaseline(doc);
      set((state) => ({
        documents: {
          ...state.documents,
          [doc.id]: bumpEntry(doc, state.documents[doc.id]),
        },
        session: {
          ...state.session,
          activeDocumentId: doc.id,
          workspaceId: doc.metadata.workspaceId ?? state.session.workspaceId,
        },
      }));
    },

    unloadDocument: (documentId) => {
      set((state) => {
        const next = { ...state.documents };
        delete next[documentId];
        return {
          documents: next,
          session: {
            ...state.session,
            activeDocumentId: state.session.activeDocumentId === documentId ? null : state.session.activeDocumentId,
          },
        };
      });
    },

    setActiveDocumentId: (id) => {
      set((state) => ({ session: { ...state.session, activeDocumentId: id } }));
    },

    updateDocument: (documentId, updater, opts) => {
      const entry = get().documents[documentId];
      if (!entry) return;
      const pushHistory = opts?.pushHistory ?? true;
      if (pushHistory) get().revisionStack.push(entry.document, opts?.label);
      const nextDoc = updater(entry.document);
      set((state) => ({
        documents: {
          ...state.documents,
          [documentId]: bumpEntry(nextDoc, state.documents[documentId]),
        },
      }));
    },

    updateActiveDocument: (updater, opts) => {
      const id = get().session.activeDocumentId;
      if (!id) return;
      get().updateDocument(id, updater, opts);
    },

    setSelection: (selection) => {
      set((state) => ({ session: { ...state.session, selection } }));
    },

    setViewport: (viewport) => {
      set((state) => ({ session: { ...state.session, viewport: { ...viewport } } }));
    },

    patchViewport: (patch) => {
      set((state) => ({
        session: { ...state.session, viewport: { ...state.session.viewport, ...patch } },
      }));
    },

    setActiveToolId: (toolId) => {
      set((state) => ({ session: { ...state.session, activeToolId: toolId, toolState: {} } }));
    },

    setToolState: (patch) => {
      set((state) => ({
        session: { ...state.session, toolState: { ...state.session.toolState, ...patch } },
      }));
    },

    clearToolState: () => {
      set((state) => ({ session: { ...state.session, toolState: {} } }));
    },

    pushHistory: (label) => {
      const id = get().session.activeDocumentId;
      const entry = id ? get().documents[id] : undefined;
      if (entry) get().revisionStack.push(entry.document, label);
    },

    undo: () => {
      const id = get().session.activeDocumentId;
      const entry = id ? get().documents[id] : undefined;
      if (!entry) return;
      const restored = get().revisionStack.undo(entry.document);
      if (!restored || !id) return;
      set((state) => ({
        documents: { ...state.documents, [id]: bumpEntry(restored, state.documents[id]) },
      }));
    },

    redo: () => {
      const id = get().session.activeDocumentId;
      const entry = id ? get().documents[id] : undefined;
      if (!entry) return;
      const restored = get().revisionStack.redo(entry.document);
      if (!restored || !id) return;
      set((state) => ({
        documents: { ...state.documents, [id]: bumpEntry(restored, state.documents[id]) },
      }));
    },

    setOperationalOverlays: (overlays) => {
      set((state) => ({
        session: { ...state.session, operationalOverlays: overlays },
      }));
    },

    setOperationalLayerToggles: (toggles) => {
      set((state) => ({
        session: {
          ...state.session,
          operationalLayerToggles: { ...state.session.operationalLayerToggles, ...toggles },
        },
      }));
    },

    setOverlayVisible: (overlayId, visible) => {
      set((state) => ({
        session: {
          ...state.session,
          overlayVisibility: { ...state.session.overlayVisibility, [overlayId]: visible },
          operationalOverlays: state.session.operationalOverlays.map((o) =>
            o.id === overlayId ? { ...o, visible } : o,
          ),
        },
      }));
    },
  })),
);

export function selectActiveDocument(state: SpatialRuntimeStoreState): SpatialDocument | null {
  const id = state.session.activeDocumentId;
  if (!id) return null;
  return state.documents[id]?.document ?? null;
}

export function selectActiveDocumentRevision(state: SpatialRuntimeStoreState): number {
  const id = state.session.activeDocumentId;
  if (!id) return 0;
  return state.documents[id]?.revision ?? 0;
}
