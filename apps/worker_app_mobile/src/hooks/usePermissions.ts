import { useSessionStore } from "@/store/useSessionStore";
import type { AppPermissions } from "@/types/user";

export function usePermissions(): AppPermissions {
  return useSessionStore((s) => s.permissions);
}
