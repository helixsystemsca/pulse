import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";
import { API_PREFIX, getApiBaseUrl } from "@/utils/config";
import { useSessionStore } from "@/store/useSessionStore";

/**
 * Shared FastAPI-oriented HTTP client.
 * Replace mock hooks with `apiClient.get/post/...` when wiring real endpoints.
 */
function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: `${getApiBaseUrl()}${API_PREFIX}`,
    timeout: 25_000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  instance.interceptors.request.use((config) => {
    const token = useSessionStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    async (err: AxiosError) => {
      if (err.response?.status === 401) {
        await useSessionStore.getState().logout();
      }
      return Promise.reject(err);
    },
  );

  return instance;
}

export const apiClient = createApiClient();

/** Typed helpers — expand per resource as backend stabilizes. */
export const assignmentsApi = {
  listToday: (config?: AxiosRequestConfig) => apiClient.get("/field/assignments/today", config),
  getById: (id: string, config?: AxiosRequestConfig) => apiClient.get(`/field/assignments/${id}`, config),
  updateStatus: (id: string, body: { status: string }, config?: AxiosRequestConfig) =>
    apiClient.patch(`/field/assignments/${id}/status`, body, config),
};

export const toolsApi = {
  listMine: (config?: AxiosRequestConfig) => apiClient.get("/field/tools/mine", config),
};
