import { apiFetch } from "./client";

export type PulseMe = {
  id: string;
  email: string;
  company_id?: string | null;
  role: string;
  roles: string[];
  full_name?: string | null;
  avatar_url?: string | null;
  avatar_status?: "approved" | "pending" | "rejected" | string | null;
  permissions?: string[] | null;
  company?: {
    id: string;
    name: string;
    logo_url?: string | null;
    header_image_url?: string | null;
    background_image_url?: string | null;
    timezone?: string | null;
    industry?: string | null;
  } | null;
};

export type Organization = {
  id: string;
  name: string;
  logo_url?: string | null;
  background_image_url?: string | null;
  theme?: Record<string, unknown>;
};

export async function getMe(token: string): Promise<PulseMe> {
  return apiFetch<PulseMe>("/api/v1/auth/me", { token });
}

export async function getOrganization(token: string): Promise<Organization> {
  return apiFetch<Organization>("/api/v1/organization", { token });
}

