import { useNavigation } from "@react-navigation/native";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FORM_CATALOG } from "@/data/formCatalog";
import { colors, layout, radius, shadows, space, typography } from "@/utils/designTokens";

export function FormsScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={typography.screenTitle}>FORMS</Text>
      <Text style={typography.greeting}>Checklists</Text>
      <FlatList
        data={FORM_CATALOG}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ paddingTop: space.md, paddingBottom: space.xxl }}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
            onPress={() =>
              (navigation as { navigate: (a: string, b: object) => void }).navigate("FormFill", {
                formId: item.id,
              })
            }
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.desc}>{item.description}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: layout.screenPaddingH },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  name: { ...typography.body, fontWeight: "800", color: colors.textPrimary },
  desc: { marginTop: 4, ...typography.bodySm, color: colors.textSecondary },
});
