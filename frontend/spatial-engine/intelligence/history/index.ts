export type {
  SpatialHistoryEvent,
  SpatialHistoryListener,
  SpatialRevisionSnapshot,
  SpatialRevisionStackOptions,
  UndoRedoState,
} from "@/spatial-engine/intelligence/history/types";
export {
  createRevisionSnapshot,
  restoreRevisionSnapshot,
  SpatialRevisionStack,
} from "@/spatial-engine/intelligence/history/revision-stack";
