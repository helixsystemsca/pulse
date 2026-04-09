import * as Notifications from "expo-notifications";
import { router } from "expo-router";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensurePushPermissions() {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.status === "granted") return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.status === "granted";
}

export function registerNotificationDeepLinks() {
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const data = resp.notification.request.content.data as Record<string, unknown> | undefined;
    const to = typeof data?.to === "string" ? data.to : null;
    if (to) router.push(to as never);
  });
  return () => sub.remove();
}

// Scaffold: local notification helper for testing flows.
export async function notifyLocal(opts: { title: string; body: string; to?: string }) {
  await Notifications.scheduleNotificationAsync({
    content: { title: opts.title, body: opts.body, data: opts.to ? { to: opts.to } : {} },
    trigger: null,
  });
}

