import type { WorldPoint } from "@/spatial-engine/types/spatial";

export type CollaborationParticipant = {
  userId: string;
  displayName?: string;
  color?: string;
  cursor?: WorldPoint | null;
  lastSeenAt?: string;
};

/** Session metadata — hosts sync document head revision id out of band. */
export type SpatialCollaborationSession = {
  sessionId: string;
  documentId: string;
  revisionHeadId: string;
  participants: CollaborationParticipant[];
  createdAt: string;
  updatedAt: string;
};

export type SpatialPatchOperation = "set" | "add" | "remove";

/** JSON-pointer style path into serialized document (foundation for future CRDT/OT). */
export type SpatialPatch = {
  op: SpatialPatchOperation;
  path: string;
  value?: unknown;
};

export type SpatialCollaborationMessage =
  | { type: "cursor"; userId: string; cursor: WorldPoint | null }
  | { type: "patch"; userId: string; patches: SpatialPatch[]; baseRevisionId: string }
  | { type: "presence"; userId: string; displayName?: string };
