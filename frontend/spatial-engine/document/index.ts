export { createEmptySpatialDocument, type CreateSpatialDocumentOptions } from "@/spatial-engine/document/create-document";
export * from "@/spatial-engine/document/layers";
export {
  getDocumentLayer,
  requireDocumentLayer,
  sortedDocumentLayers,
  visibleDocumentLayers,
} from "@/spatial-engine/document/query";
export {
  deserializeSpatialDocument,
  parseSpatialDocumentObject,
  serializeSpatialDocument,
  type SerializedSpatialDocument,
} from "@/spatial-engine/document/serialization";
export {
  SPATIAL_DOCUMENT_VERSION,
  type SpatialBackdrop,
  type SpatialBackdropKind,
  type SpatialCalibration,
  type SpatialCalibrationStatus,
  type SpatialCoordinateSpace,
  type SpatialDocument,
  type SpatialDocumentMetadata,
  type SpatialWorkspaceKind,
} from "@/spatial-engine/document/types";
