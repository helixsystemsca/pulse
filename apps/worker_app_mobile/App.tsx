import "react-native-gesture-handler";
import { useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "@/navigation/RootNavigator";
import { ensurePushChannelAsync } from "@/services/push";
import { useAppStore } from "@/store/useAppStore";
import { TOKEN_KEY } from "@/utils/config";

export default function App() {
  useEffect(() => {
    void ensurePushChannelAsync();

    (async () => {
      try {
        const t = await SecureStore.getItemAsync(TOKEN_KEY);
        if (t) {
          useAppStore.setState({ token: t });
          await useAppStore.getState().bootstrapUser();
        }
      } catch {
        await useAppStore.getState().logout();
      } finally {
        useAppStore.getState().setHydrated(true);
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
