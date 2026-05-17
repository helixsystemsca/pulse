import type { SpatialDocument } from "@/spatial-engine/document/types";
import type { SpatialWorkspaceKind } from "@/spatial-engine/document/types";

/**
 * Domain-agnostic persistence contract.
 * Each workspace implements its own adapter — no shared DB schema required.
 */
export interface SpatialPersistenceAdapter<TDomain, TExternal = TDomain> {
  readonly workspaceId: SpatialWorkspaceKind;
  readonly adapterKey: string;

  /** Map domain model → canonical spatial document. */
  toDocument(domain: TDomain): SpatialDocument;

  /** Map canonical spatial document → domain model. */
  fromDocument(document: SpatialDocument): TDomain;

  /** Load external record by id (API row, mock id, …). */
  load(externalId: string): Promise<TExternal>;

  /** Persist domain model through external store. */
  save(externalId: string, domain: TDomain): Promise<TExternal>;

  serialize(document: SpatialDocument): string;
  deserialize(payload: string): SpatialDocument;
}

export type SpatialPersistenceResult<T> = {
  document: SpatialDocument;
  external: T;
};
