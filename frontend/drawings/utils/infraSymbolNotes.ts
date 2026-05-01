/** Persist infra ↔ blueprint links in `BlueprintElement.symbol_notes` (JSON payload). */

export const INFRA_NOTES_PREFIX = "pulse-infra:v1:";

export type InfraNotesPayload = {
  asset_id?: string;
};

export function packInfraAssetNotes(assetId: string): string {
  const payload: InfraNotesPayload = { asset_id: assetId };
  return `${INFRA_NOTES_PREFIX}${JSON.stringify(payload)}`;
}

export function parseInfraAssetFromNotes(symbol_notes?: string | null): string | null {
  if (!symbol_notes?.startsWith(INFRA_NOTES_PREFIX)) return null;
  try {
    const payload = JSON.parse(symbol_notes.slice(INFRA_NOTES_PREFIX.length)) as InfraNotesPayload;
    return typeof payload.asset_id === "string" ? payload.asset_id : null;
  } catch {
    return null;
  }
}
