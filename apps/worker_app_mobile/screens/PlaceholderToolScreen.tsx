import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, layout, space, typography } from "@/utils/designTokens";

export function PlaceholderToolScreen({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="chevron-left" size={28} color={colors.textPrimary} />
        <Text style={styles.backTxt}>Back</Text>
      </Pressable>
      <Text style={typography.greeting}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: layout.screenPaddingH },
  back: { flexDirection: "row", alignItems: "center", marginBottom: space.md },
  backTxt: { ...typography.body, fontWeight: "600", marginLeft: 4 },
  body: { marginTop: space.md, ...typography.bodySm, color: colors.textSecondary, lineHeight: 22 },
});
