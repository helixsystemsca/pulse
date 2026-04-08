import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AvailabilityEditorScreen } from "@/screens/schedule/AvailabilityEditorScreen";
import { ScheduleScreen } from "@/screens/schedule/ScheduleScreen";
import { VacationRequestScreen } from "@/screens/schedule/VacationRequestScreen";
import { colors } from "@/utils/designTokens";
import type { ScheduleStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<ScheduleStackParamList>();

export function ScheduleNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="ScheduleMain" component={ScheduleScreen} />
      <Stack.Screen name="VacationRequest" component={VacationRequestScreen} />
      <Stack.Screen name="AvailabilityEditor" component={AvailabilityEditorScreen} />
    </Stack.Navigator>
  );
}
