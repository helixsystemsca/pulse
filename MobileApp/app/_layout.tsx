import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { ThemeProvider } from "@/theme/ThemeProvider";
import { SessionProvider } from "@/store/session";
import { ensurePushPermissions, registerNotificationDeepLinks } from "@/lib/notifications";
import { ensureApiConfiguredFromEnv } from "@/lib/api/client";
import { SafeAreaProvider } from "react-native-safe-area-context";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
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
          <RootSideEffects />
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
          </Stack>
        </SessionProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function RootSideEffects() {
  useEffect(() => {
    // Configure API base URL from env. Example:
    // EXPO_PUBLIC_API_BASE_URL=https://pulse.helixsystems.ca
    ensureApiConfiguredFromEnv();
    void ensurePushPermissions();
    const unsub = registerNotificationDeepLinks();
    return unsub;
  }, []);
  return null;
}
