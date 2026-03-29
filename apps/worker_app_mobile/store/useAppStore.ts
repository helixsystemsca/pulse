import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { UserMe } from "@/services/auth";
import { fetchMe, login as apiLogin } from "@/services/auth";
import { fetchSiteMissing, fetchWorkerTools } from "@/services/tools";
import { TOKEN_KEY } from "@/utils/config";
import { isWorkerAlertEventType, streamEventTitleBody } from "@/utils/stream";
import type { StreamEvent } from "@/utils/streamTypes";

export type FeedItem = {
  id: string;
  title: string;
  body: string;
  event_type: string;
  at: string;
};

export type StreamStatus = "idle" | "connecting" | "live" | "error";

type AppState = {
  hydrated: boolean;
  token: string | null;
  user: UserMe | null;
  assignedTools: Awaited<ReturnType<typeof fetchWorkerTools>>;
  siteMissing: Awaited<ReturnType<typeof fetchSiteMissing>>;
  feedItems: FeedItem[];
  streamStatus: StreamStatus;
  lastStreamEvent: StreamEvent | null;
  lastError: string | null;
  setHydrated: (v: boolean) => void;
  setToken: (token: string | null) => void;
  setUser: (user: UserMe | null) => void;
  setStreamStatus: (s: StreamStatus) => void;
  pushFeedFromStream: (ev: StreamEvent) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrapUser: () => Promise<void>;
  refreshWorkerData: () => Promise<void>;
  hasFeature: (key: string) => boolean;
};

const MAX_FEED = 25;

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  token: null,
  user: null,
  assignedTools: [],
  siteMissing: [],
  feedItems: [],
  streamStatus: "idle",
  lastStreamEvent: null,
  lastError: null,

  setHydrated: (hydrated) => set({ hydrated }),
  setToken: (token) => set({ token }),
  setUser: (user) => set({ user }),
  setStreamStatus: (streamStatus) => set({ streamStatus }),

  pushFeedFromStream: (ev) => {
    if (!isWorkerAlertEventType(ev.event_type)) return;
    const { title, body } = streamEventTitleBody(ev);
    const id = `${ev.event_type}-${ev.correlation_id ?? Date.now()}`;
    const item: FeedItem = {
      id,
      title,
      body,
      event_type: ev.event_type,
      at: new Date().toISOString(),
    };
    set((s) => ({ feedItems: [item, ...s.feedItems].slice(0, MAX_FEED), lastStreamEvent: ev }));
  },

  hasFeature: (key) => {
    const feats = get().user?.enabled_features ?? [];
    return feats.includes(key);
  },

  login: async (email, password) => {
    set({ lastError: null });
    const res = await apiLogin(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, res.access_token);
    set({ token: res.access_token });
    const me = await fetchMe();
    set({ user: me });
    await get().refreshWorkerData();
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    set({
      token: null,
      user: null,
      assignedTools: [],
      siteMissing: [],
      feedItems: [],
      streamStatus: "idle",
      lastStreamEvent: null,
    });
  },

  bootstrapUser: async () => {
    const me = await fetchMe();
    set({ user: me });
    await get().refreshWorkerData();
  },

  refreshWorkerData: async () => {
    const { user, hasFeature } = get();
    if (!user || !hasFeature("tool_tracking")) {
      set({ assignedTools: [], siteMissing: [] });
      return;
    }
    try {
      const [assigned, missing] = await Promise.all([fetchWorkerTools(), fetchSiteMissing()]);
      set({ assignedTools: assigned, siteMissing: missing, lastError: null });
    } catch (e) {
      set({
        lastError: e instanceof Error ? e.message : "refresh failed",
      });
    }
  },
}));
