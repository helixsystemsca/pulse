import axios, { type AxiosError } from "axios";
import { getApiBaseUrl } from "@/utils/config";
import { useAppStore } from "@/store/useAppStore";

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 25_000,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAppStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      await useAppStore.getState().logout();
    }
    return Promise.reject(err);
  },
);
