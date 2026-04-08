import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BlueprintScreen } from "@/screens/blueprint/BlueprintScreen";
import { MarkerDetailScreen } from "@/screens/blueprint/MarkerDetailScreen";
import { colors } from "@/utils/designTokens";
import type { BlueprintStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<BlueprintStackParamList>();

export function BlueprintNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="BlueprintMain" component={BlueprintScreen} />
      <Stack.Screen name="MarkerDetail" component={MarkerDetailScreen} />
    </Stack.Navigator>
  );
}
