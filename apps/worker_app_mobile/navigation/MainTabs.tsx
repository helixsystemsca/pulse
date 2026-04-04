import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StreamBridge } from "@/components/StreamBridge";
import { AlertsStack, DashboardStack, FormsStack, IssuesStack, ToolboxStack } from "@/navigation/AppStacks";
import { colors, layout } from "@/utils/designTokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator();

const ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Dashboard: "view-dashboard-outline",
  Issues: "clipboard-list-outline",
  Toolbox: "hammer-wrench",
  Forms: "file-document-edit-outline",
  Alerts: "bell-outline",
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
            fontSize: 10,
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
        <Tab.Screen name="Dashboard" component={DashboardStack} options={{ title: "Dashboard" }} />
        <Tab.Screen name="Issues" component={IssuesStack} options={{ title: "Issues" }} />
        <Tab.Screen name="Toolbox" component={ToolboxStack} options={{ title: "Toolbox" }} />
        <Tab.Screen name="Forms" component={FormsStack} options={{ title: "Forms" }} />
        <Tab.Screen name="Alerts" component={AlertsStack} options={{ title: "Alerts" }} />
      </Tab.Navigator>
    </>
  );
}
