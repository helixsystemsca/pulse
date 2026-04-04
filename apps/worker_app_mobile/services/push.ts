/**
 * Push / local notifications (Expo). Critical → immediate; warnings → same channel (grouping via OS);
 * info → in-app feed only (caller should skip scheduling).
 */

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { AlertPushTier } from "@/utils/stream";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function ensurePushChannelAsync(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("field-critical", {
      name: "Critical field alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: "#B91C1C",
    });
    await Notifications.setNotificationChannelAsync("field-warnings", {
      name: "Field warnings",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#C2410C",
    });
    await Notifications.setNotificationChannelAsync("floor-alerts", {
      name: "Floor alerts (legacy)",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 120, 250],
      lightColor: "#0F766E",
    });
  }
}

export async function requestLocalNotificationPermissions(): Promise<Notifications.PermissionStatus> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return existing;
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

export async function tryGetExpoPushToken(): Promise<string | null> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return null;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

/** Schedule local notification from realtime stream (tiers map to product rules). */
export async function dispatchTieredFieldAlert(
  tier: AlertPushTier,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (tier === "info") {
    return;
  }
  const androidChannelId = tier === "critical" ? "field-critical" : "field-warnings";
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: data ?? {},
      priority:
        tier === "critical"
          ? Notifications.AndroidNotificationPriority.MAX
          : Notifications.AndroidNotificationPriority.DEFAULT,
      ...(Platform.OS === "android" ? { channelId: androidChannelId } : {}),
    },
    trigger: null,
  });
}

export async function presentLocalMissingToolAlert(title: string, body: string): Promise<void> {
  await dispatchTieredFieldAlert("warning", title, body);
}
