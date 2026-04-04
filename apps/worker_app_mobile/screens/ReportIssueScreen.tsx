import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useCreateIssueMutation } from "@/hooks/useWorkRequests";
import { colors, layout, radius, space, typography } from "@/utils/designTokens";

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

export function ReportIssueScreen() {
  const navigation = useNavigation();
  const createMut = useCreateIssueMutation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");

  function submit() {
    const t = title.trim();
    if (t.length < 3) {
      Alert.alert("Title needed", "Add a short title so the team can find this.");
      return;
    }
    createMut.mutate(
      { title: t, description: description.trim() || undefined, priority },
      {
        onSuccess: () => {
          navigation.goBack();
        },
        onError: () => Alert.alert("Could not submit", "Check connection and try again."),
      },
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Report issue</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What’s wrong?"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
        />

        <Text style={styles.label}>Details (optional)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Location, what you saw…"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, styles.tall]}
          multiline
        />

        <Text style={styles.label}>Priority</Text>
        <View style={styles.pRow}>
          {PRIORITIES.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPriority(p)}
              style={[styles.pChip, priority === p && styles.pChipOn]}
            >
              <Text style={[styles.pChipTxt, priority === p && styles.pChipTxtOn]}>{p}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.submit, createMut.isPending && { opacity: 0.6 }]}
          onPress={submit}
          disabled={createMut.isPending}
        >
          <Text style={styles.submitTxt}>{createMut.isPending ? "Submitting…" : "Submit issue"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: space.md,
  },
  topTitle: { ...typography.section },
  form: { paddingHorizontal: layout.screenPaddingH },
  label: { ...typography.caption, color: colors.textTertiary, marginBottom: space.xs },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: space.md,
    marginBottom: space.md,
    color: colors.textPrimary,
  },
  tall: { minHeight: 100, textAlignVertical: "top" },
  pRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginBottom: space.lg },
  pChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pChipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pChipTxt: { ...typography.caption, textTransform: "capitalize", color: colors.textSecondary },
  pChipTxtOn: { color: colors.accent, fontWeight: "800" },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
