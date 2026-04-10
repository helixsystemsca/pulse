import { apiPostFormData } from "@/lib/api";

type ProfileAvatarUploadOut = {
  avatar_url?: string;
  message?: string;
};

/** POST /api/v1/profile/avatar */
export async function uploadProfileAvatarFile(file: File): Promise<ProfileAvatarUploadOut> {
  const fd = new FormData();
  fd.set("file", file);
  return apiPostFormData<ProfileAvatarUploadOut>("/api/v1/profile/avatar", fd);
}
