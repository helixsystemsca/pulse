import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, radius, space, typography } from "@/utils/designTokens";

export function FlagIssueScreen() {
  const tabBar = useBottomTabBarHeight();
  const nav = useNavigation();
  const route = useRoute();
  const { taskId } = route.params as { taskId: string };
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) {
      Alert.alert("Describe the issue", "Add a short summary for dispatch.");
      return;
    }
    Alert.alert("Reported", `Task ${taskId} flagged (mock).`, [{ text: "OK", onPress: () => nav.goBack() }]);
  };

  return (
    <ScreenContainer scroll bottomInset={tabBar}>
      <Text style={[typography.title, styles.title]}>Flag issue</Text>
      <Text style={[typography.bodySm, styles.sub]}>Task ID: {taskId}</Text>
      <TextInput
        style={styles.input}
        placeholder="What’s wrong? Include location context."
        placeholderTextColor={colors.textTertiary}
        multiline
        value={text}
        onChangeText={setText}
      />
      <View style={styles.row}>
        <SecondaryButton label="Cancel" onPress={() => nav.goBack()} style={styles.flex} />
        <PrimaryButton label="Submit" onPress={submit} style={styles.flex} />
      </View>
      <View style={{ height: tabBar }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, marginBottom: space.sm },
  sub: { color: colors.textSecondary, marginBottom: space.lg },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    textAlignVertical: "top",
    color: colors.textPrimary,
    marginBottom: space.lg,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: "row", gap: space.md },
  flex: { flex: 1 },
});
