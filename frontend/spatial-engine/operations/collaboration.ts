import type { WorldPoint } from "@/spatial-engine/types/spatial";
import type { SpatialPatch } from "@/spatial-engine/intelligence/collaboration/types";

/** Threaded comment anchored to a spatial feature or world point. */
export type SpatialComment = {
  id: string;
  documentId: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  /** Feature anchor or free point. */
  anchor?: {
    featureId?: string;
    layerType?: string;
    position?: WorldPoint;
  };
  resolved?: boolean;
};

/** Approval workflow state for published spatial documents. */
export type SpatialApprovalRequest = {
  id: string;
  documentId: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  reviewers: string[];
  snapshotId?: string;
  note?: string;
};

/** Markup stroke / region for review workflows (not canonical geometry). */
export type SpatialMarkupAnnotation = {
  id: string;
  documentId: string;
  authorId: string;
  kind: "pin" | "polyline" | "rect" | "text";
  points: number[];
  label?: string;
  color?: string;
  createdAt: string;
};

export type SpatialCollaborationBundle = {
  comments: SpatialComment[];
  approvals: SpatialApprovalRequest[];
  markups: SpatialMarkupAnnotation[];
  pendingPatches: SpatialPatch[];
};

export function createEmptyCollaborationBundle(): SpatialCollaborationBundle {
  return {
    comments: [],
    approvals: [],
    markups: [],
    pendingPatches: [],
  };
}
