import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { linking } from "@/navigation/linking";
import { MainTabs } from "@/navigation/MainTabs";
import { navigationRef, navigateToIssueDetail } from "@/navigation/navigationRef";
import { LoginScreen } from "@/screens/LoginScreen";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/utils/designTokens";

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const hydrated = useAppStore((s) => s.hydrated);
  const token = useAppStore((s) => s.token);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const raw = response.notification.request.content.data?.issueId;
      const issueId = typeof raw === "string" ? raw : undefined;
      if (issueId) navigateToIssueDetail(issueId);
    });
    return () => sub.remove();
  }, []);

  if (!hydrated) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        {token ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
});
