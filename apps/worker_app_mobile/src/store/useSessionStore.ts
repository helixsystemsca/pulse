import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { SESSION_KEY } from "@/utils/config";
import { getPermissionsForRole } from "@/utils/permissions";
import type { AppPermissions, User, UserRole } from "@/types/user";

interface PersistedSession {
  token: string | null;
  user: User;
}

interface SessionState {
  hydrated: boolean;
  token: string | null;
  user: User | null;
  permissions: AppPermissions;
  setHydrated: (v: boolean) => void;
  hydrate: () => Promise<void>;
  login: (params: { email: string; displayName: string; role: UserRole }) => Promise<void>;
  logout: () => Promise<void>;
}

function defaultPermissions(): AppPermissions {
  return getPermissionsForRole("technician");
}

export const useSessionStore = create<SessionState>((set, get) => ({
  hydrated: false,
  token: null,
  user: null,
  permissions: defaultPermissions(),

  setHydrated: (v) => set({ hydrated: v }),

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedSession;
        if (parsed?.user?.role) {
          set({
            token: parsed.token ?? "mock-jwt",
            user: parsed.user,
            permissions: getPermissionsForRole(parsed.user.role),
          });
        }
      }
    } catch {
      /* ignore */
    } finally {
      set({ hydrated: true });
    }
  },

  login: async ({ email, displayName, role }) => {
    const user: User = {
      id: `usr_${Date.now()}`,
      email: email.trim() || "operator@example.com",
      displayName: displayName.trim() || "Field Operator",
      role,
    };
    const token = "mock-jwt-token";
    const session: PersistedSession = { token, user };
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    set({
      token,
      user,
      permissions: getPermissionsForRole(role),
    });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    set({ token: null, user: null, permissions: defaultPermissions() });
  },
}));
