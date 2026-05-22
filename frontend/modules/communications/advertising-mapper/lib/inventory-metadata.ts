import type { InventoryBlock } from "@/modules/communications/advertising-mapper/types";

/** Fields mirrored on spatial inventory item metadata. */
export function inventoryBlockToMetadata(block: InventoryBlock): Record<string, unknown> {
  return {
    name: block.name,
    status: block.status,
    sponsor: block.sponsor,
    zone: block.zone,
    visibilityTier: block.visibilityTier,
    priceTier: block.priceTier,
    inventoryId: block.inventoryId,
    mountingType: block.mountingType,
    expiryDate: block.expiryDate,
    assetUrl: block.assetUrl,
    sizePreset: block.sizePreset,
    locationLabel: block.locationLabel,
    contactName: block.contactName,
    contactEmail: block.contactEmail,
    contactPhone: block.contactPhone,
    contractStructure: block.contractStructure,
  };
}

export function inventoryMetadataPatch(patch: Partial<InventoryBlock>): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (patch.name !== undefined) meta.name = patch.name;
  if (patch.status !== undefined) meta.status = patch.status;
  if (patch.sponsor !== undefined) meta.sponsor = patch.sponsor;
  if (patch.zone !== undefined) meta.zone = patch.zone;
  if (patch.visibilityTier !== undefined) meta.visibilityTier = patch.visibilityTier;
  if (patch.priceTier !== undefined) meta.priceTier = patch.priceTier;
  if (patch.inventoryId !== undefined) meta.inventoryId = patch.inventoryId;
  if (patch.mountingType !== undefined) meta.mountingType = patch.mountingType;
  if (patch.expiryDate !== undefined) meta.expiryDate = patch.expiryDate;
  if (patch.assetUrl !== undefined) meta.assetUrl = patch.assetUrl;
  if (patch.sizePreset !== undefined) meta.sizePreset = patch.sizePreset;
  if (patch.locationLabel !== undefined) meta.locationLabel = patch.locationLabel;
  if (patch.contactName !== undefined) meta.contactName = patch.contactName;
  if (patch.contactEmail !== undefined) meta.contactEmail = patch.contactEmail;
  if (patch.contactPhone !== undefined) meta.contactPhone = patch.contactPhone;
  if (patch.contractStructure !== undefined) meta.contractStructure = patch.contractStructure;
  return meta;
}
