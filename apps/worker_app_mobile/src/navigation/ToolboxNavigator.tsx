import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ToolboxScreen } from "@/screens/toolbox/ToolboxScreen";
import { colors } from "@/utils/designTokens";
import type { ToolboxStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<ToolboxStackParamList>();

export function ToolboxNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="ToolboxList" component={ToolboxScreen} />
    </Stack.Navigator>
  );
}
