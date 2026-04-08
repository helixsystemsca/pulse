import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { linking } from "@/navigation/linking";
import { MainTabs } from "@/navigation/MainTabs";
import { navigationRef } from "@/navigation/navigationRef";
import { LoginScreen } from "@/screens/auth/LoginScreen";
import { useSessionStore } from "@/store/useSessionStore";
import { colors } from "@/utils/designTokens";
import type { RootStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const hydrated = useSessionStore((s) => s.hydrated);
  const token = useSessionStore((s) => s.token);

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
