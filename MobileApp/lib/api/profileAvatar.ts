import { apiPostFormData } from "@/lib/api/client";

export type ProfileAvatarUploadOut = {
  avatar_url?: string;
  message?: string;
};

/** POST /api/v1/profile/avatar */
export async function uploadProfileAvatar(
  token: string,
  uri: string,
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
): Promise<ProfileAvatarUploadOut> {
  const name =
    (fileName && fileName.trim()) ||
    (mimeType?.toLowerCase().includes("png") ? "photo.png" : "photo.jpg");
  const type =
    mimeType && mimeType.trim()
      ? mimeType
      : name.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg";

  const fd = new FormData();
  fd.append("file", { uri, name, type } as unknown as Blob);

  return apiPostFormData<ProfileAvatarUploadOut>("/api/v1/profile/avatar", fd, { token });
}
