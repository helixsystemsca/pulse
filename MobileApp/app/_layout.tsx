import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import "react-native-reanimated";

import { ThemeProvider } from "@/theme/ThemeProvider";
import { SessionProvider, useSession } from "@/store/session";
import { ensurePushPermissions, notifyLocal, registerNotificationDeepLinks } from "@/lib/notifications";
import { apiFetch, ensureApiConfiguredFromEnv } from "@/lib/api/client";
import { subscribePulseWs } from "@/lib/realtime/pulseWs";
import { SafeAreaProvider } from "react-native-safe-area-context";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <SessionProvider>
          <RootBootstrap />
          <SessionLifecycle />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="task-detail"
              options={{
                headerShown: true,
                title: "Task",
                headerStyle: { backgroundColor: "#556B8E" },
                headerTintColor: "#FFFFFF",
              }}
            />
            <Stack.Screen
              name="blueprint"
              options={{
                headerShown: true,
                title: "Drawing",
                headerStyle: { backgroundColor: "#556B8E" },
                headerTintColor: "#FFFFFF",
              }}
            />
            <Stack.Screen
              name="inference-confirm"
              options={{
                headerShown: true,
                title: "Confirm",
                headerStyle: { backgroundColor: "#556B8E" },
                headerTintColor: "#FFFFFF",
              }}
            />
            <Stack.Screen
              name="notifications"
              options={{
                headerShown: true,
                title: "Notifications",
                headerStyle: { backgroundColor: "#556B8E" },
                headerTintColor: "#FFFFFF",
              }}
            />
            <Stack.Screen
              name="new-work-request"
              options={{
                headerShown: true,
                title: "Work request",
                headerStyle: { backgroundColor: "#556B8E" },
                headerTintColor: "#FFFFFF",
              }}
            />
          </Stack>
        </SessionProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function RootBootstrap() {
  useEffect(() => {
    ensureApiConfiguredFromEnv();
  }, []);
  return null;
}

function SessionLifecycle() {
  const { session } = useSession();

  useEffect(() => {
    const unsub = registerNotificationDeepLinks();
    return unsub;
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    void (async () => {
      try {
        const granted = await ensurePushPermissions();
        if (!granted) return;
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
        if (!projectId) return;
        const { getExpoPushTokenAsync } = await import("expo-notifications");
        const tokenData = await getExpoPushTokenAsync({ projectId });
        const pushToken = tokenData.data;
        await apiFetch("/api/v1/notifications/push-token", {
          method: "POST",
          token: session.token,
          body: { token: pushToken, platform: Platform.OS },
        });
      } catch {
        /* non-fatal */
      }
    })();
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token) return;
    return subscribePulseWs(session.token, async (evt) => {
      switch (evt.event_type) {
        case "schedule.period_published":
          await notifyLocal({
            title: "Schedule published",
            body: "Your schedule is ready. Tap to view your shifts.",
            to: "/(tabs)/schedule",
          });
          break;
        case "maintenance_inference_request":
        case "demo_inference_fired": {
          const meta = (evt.metadata ?? {}) as Record<string, unknown>;
          const aid = String(meta.inference_id ?? evt.entity_id ?? "");
          const assetName = String(meta.asset_name ?? "an asset");
          const conf = meta.confidence ?? 0;
          const overdue = meta.pm_overdue_days ?? 0;
          await notifyLocal({
            title: "Maintenance detected",
            body: `Are you working on ${assetName}? Tap to confirm.`,
            to: `/inference-confirm?inference_id=${encodeURIComponent(aid)}&asset_name=${encodeURIComponent(assetName)}&confidence=${encodeURIComponent(String(conf))}&pm_overdue_days=${encodeURIComponent(String(overdue))}`,
          });
          break;
        }
        case "work_request.assigned":
          await notifyLocal({
            title: "New task assigned",
            body: String((evt.metadata as Record<string, unknown> | undefined)?.title ?? "A work request has been assigned to you."),
            to: "/(tabs)/tasks",
          });
          break;
        default:
          break;
      }
    });
  }, [session?.token]);

  return null;
}
