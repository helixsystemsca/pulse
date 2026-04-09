import { router } from "expo-router";
import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";

function isExpoGo(): boolean {
  // Expo Go cannot do remote push notifications as of SDK 53.
  return Constants.appOwnership === "expo";
}

let notificationsMod: typeof import("expo-notifications") | null = null;

async function getNotifications() {
  if (notificationsMod) return notificationsMod;
  const mod = await import("expo-notifications");
  mod.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  notificationsMod = mod;
  return mod;
}

export async function ensurePushPermissions() {
  // Scaffold only: avoid crashes on web / simulators / emulators.
  if (Platform.OS === "web") return false;
  if (!Device.isDevice) return false;
  if (isExpoGo()) return false;

  // Some Expo flows will throw if projectId is missing; skip in that case.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  if (!projectId) return false;

  const Notifications = await getNotifications();
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const cur = await Notifications.getPermissionsAsync();
  if (cur.status === "granted") return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.status === "granted";
}

export function registerNotificationDeepLinks() {
  // In Expo Go, `expo-notifications` remote notifications are not supported, and importing it
  // can throw. We still want the app to boot, so no-op here.
  if (isExpoGo()) return () => {};

  let remove = () => {};
  void (async () => {
    const Notifications = await getNotifications();
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as Record<string, unknown> | undefined;
      const to = typeof data?.to === "string" ? data.to : null;
      if (to) router.push(to as never);
    });
    remove = () => sub.remove();
  })();

  return () => remove();
}

// Scaffold: local notification helper for testing flows.
export async function notifyLocal(opts: { title: string; body: string; to?: string }) {
  if (isExpoGo()) return;
  const Notifications = await getNotifications();
  await Notifications.scheduleNotificationAsync({
    content: { title: opts.title, body: opts.body, data: opts.to ? { to: opts.to } : {} },
    trigger: null,
  });
}

