import React from "react";
import { ActivityIndicator, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import type { Href } from "expo-router";
import { Redirect, Tabs } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { BLEPromptHost } from "./_ble";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }) {
  return <FontAwesome size={22} {...props} />;
}

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, authReady } = useSession();

  if (!authReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href={"/login" as Href} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.success,
            tabBarInactiveTintColor: colors.muted,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              paddingBottom: Math.max(insets.bottom, 8),
              height: 62 + Math.max(insets.bottom, 8),
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Home",
              tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
            }}
          />
          {/* Internal route used by BLEPromptHost. Hide from tab bar. */}
          <Tabs.Screen name="_ble" options={{ href: null }} />
          <Tabs.Screen
            name="toolbox"
            options={{
              title: "Toolbox",
              tabBarIcon: ({ color }) => <TabBarIcon name="wrench" color={color} />,
            }}
          />
          <Tabs.Screen
            name="schedule"
            options={{
              title: "Schedule",
              tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />,
            }}
          />
          <Tabs.Screen
            name="tasks"
            options={{
              title: "Tasks",
              tabBarIcon: ({ color }) => <TabBarIcon name="check-square" color={color} />,
            }}
          />
          <Tabs.Screen
            name="drawings"
            options={{
              title: "Drawings",
              tabBarIcon: ({ color }) => <TabBarIcon name="map-o" color={color} />,
            }}
          />
          <Tabs.Screen name="two" options={{ href: null }} />
        </Tabs>
      </SafeAreaView>
      <BLEPromptHost />
    </View>
  );
}
