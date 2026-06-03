import { apiFetch, apiPostFormData, isApiMode } from "@/lib/api";
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";

export type AdvertisingWallsResponse = {
  walls: FacilityWallPlan[];
};

function stripBackdropForSave(w: FacilityWallPlan): FacilityWallPlan {
  const { backdropUrl, backdropNaturalWidth, backdropNaturalHeight, ...rest } = w;
  if (backdropUrl?.startsWith("data:")) {
    return rest as FacilityWallPlan;
  }
  return {
    ...rest,
    ...(backdropUrl && !backdropUrl.startsWith("data:") ? { backdropUrl, backdropNaturalWidth, backdropNaturalHeight } : {}),
  } as FacilityWallPlan;
}

export async function fetchAdvertisingWalls(companyId?: string | null): Promise<FacilityWallPlan[]> {
  if (!isApiMode()) return [];
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  const out = await apiFetch<AdvertisingWallsResponse>(`/api/advertising/walls${q}`);
  return out.walls ?? [];
}

export async function saveAdvertisingWalls(
  walls: readonly FacilityWallPlan[],
  companyId?: string | null,
): Promise<FacilityWallPlan[]> {
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  const payload = walls.map(stripBackdropForSave);
  const out = await apiFetch<AdvertisingWallsResponse>(`/api/advertising/walls${q}`, {
    method: "PUT",
    json: { walls: payload },
  });
  return out.walls ?? [];
}

export async function uploadAdvertisingWallBackdrop(
  wallId: string,
  file: File,
  companyId?: string | null,
): Promise<{ backdrop_url: string }> {
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  const form = new FormData();
  form.append("file", file);
  return apiPostFormData<{ backdrop_url: string }>(
    `/api/advertising/walls/${encodeURIComponent(wallId)}/backdrop${q}`,
    form,
  );
}

/** Upload a compressed data URL by converting back to a File blob. */
export async function uploadAdvertisingWallBackdropDataUrl(
  wallId: string,
  dataUrl: string,
  companyId?: string | null,
): Promise<{ backdrop_url: string }> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], "backdrop.jpg", { type: blob.type || "image/jpeg" });
  return uploadAdvertisingWallBackdrop(wallId, file, companyId);
}
