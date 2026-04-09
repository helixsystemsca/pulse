import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { BLEPromptHost } from "./_ble";

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }) {
  return <FontAwesome size={22} {...props} />;
}

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.success,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 62,
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
      <BLEPromptHost />
    </>
  );
}
