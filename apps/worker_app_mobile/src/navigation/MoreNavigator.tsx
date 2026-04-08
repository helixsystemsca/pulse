import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MoreScreen } from "@/screens/more/MoreScreen";
import { ProjectDetailScreen } from "@/screens/more/ProjectDetailScreen";
import { colors } from "@/utils/designTokens";
import type { MoreStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="MoreMain" component={MoreScreen} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
    </Stack.Navigator>
  );
}
