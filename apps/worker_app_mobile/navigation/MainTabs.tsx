import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StreamBridge } from "@/components/StreamBridge";
import { AlertsScreen } from "@/screens/AlertsScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { ToolsScreen } from "@/screens/ToolsScreen";
import { colors, layout } from "@/utils/designTokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator();

const ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Home: "home-outline",
  Tools: "toolbox-outline",
  Alerts: "bell-outline",
  Profile: "account-outline",
};

export function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <StreamBridge />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.borderSubtle,
            height: layout.tabBarHeight + insets.bottom,
            paddingTop: 6,
            paddingBottom: Math.max(insets.bottom, 8),
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
          },
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name={ICONS[route.name] ?? "circle-outline"}
              size={24}
              color={color}
            />
          ),
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Home" }} />
        <Tab.Screen name="Tools" component={ToolsScreen} options={{ title: "Tools" }} />
        <Tab.Screen name="Alerts" component={AlertsScreen} options={{ title: "Alerts" }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
      </Tab.Navigator>
    </>
  );
}
