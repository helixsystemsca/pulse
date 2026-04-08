import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AssignmentsNavigator } from "@/navigation/AssignmentsNavigator";
import { BlueprintNavigator } from "@/navigation/BlueprintNavigator";
import { MoreNavigator } from "@/navigation/MoreNavigator";
import { ScheduleNavigator } from "@/navigation/ScheduleNavigator";
import { ToolboxNavigator } from "@/navigation/ToolboxNavigator";
import { colors, layout } from "@/utils/designTokens";

export type MainTabParamList = {
  Assignments: undefined;
  Toolbox: undefined;
  Schedule: undefined;
  Blueprint: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Assignments: "clipboard-check-outline",
  Toolbox: "toolbox-outline",
  Schedule: "calendar-month-outline",
  Blueprint: "floor-plan",
  More: "dots-horizontal",
};

export function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabInactive,
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
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={ICONS[route.name as keyof MainTabParamList]} size={size ?? 24} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Assignments" component={AssignmentsNavigator} options={{ title: "Assignments" }} />
      <Tab.Screen name="Toolbox" component={ToolboxNavigator} options={{ title: "Toolbox" }} />
      <Tab.Screen name="Schedule" component={ScheduleNavigator} options={{ title: "Schedule" }} />
      <Tab.Screen name="Blueprint" component={BlueprintNavigator} options={{ title: "Blueprint" }} />
      <Tab.Screen name="More" component={MoreNavigator} options={{ title: "More" }} />
    </Tab.Navigator>
  );
}
