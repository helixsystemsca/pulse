/**
 * Push / local notifications (Expo). Wire EAS projectId + backend for remote pushes later.
 */

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function ensurePushChannelAsync(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("floor-alerts", {
      name: "Floor alerts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 120, 250],
      lightColor: "#00d26a",
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

export async function presentLocalMissingToolAlert(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: null,
  });
}
