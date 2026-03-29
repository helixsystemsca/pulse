import { api } from "@/services/api";

export type UserMe = {
  id: string;
  email: string;
  tenant_id: string;
  role: string;
  full_name: string | null;
  enabled_features: string[];
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/api/v1/auth/login", { email, password });
  return data;
}

export async function fetchMe(): Promise<UserMe> {
  const { data } = await api.get<UserMe>("/api/v1/auth/me");
  return data;
}
