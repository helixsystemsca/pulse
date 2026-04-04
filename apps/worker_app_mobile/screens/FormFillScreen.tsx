import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { getFormById } from "@/data/formCatalog";
import { useAppStore } from "@/store/useAppStore";
import { colors, layout, radius, space, typography } from "@/utils/designTokens";

type Params = { formId: string };

export function FormFillScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { formId } = route.params as Params;
  const user = useAppStore((s) => s.user);
  const def = useMemo(() => getFormById(formId), [formId]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  if (!def) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={typography.body}>Form not found.</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.accent, marginTop: space.md }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  async function pickPhoto() {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) {
      Alert.alert("Camera", "Allow camera to attach a site photo.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.4 });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  }

  function submit() {
    Alert.alert(
      "Submitted",
      `Thanks${user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}. Your checklist was saved on-device for this demo; connect a forms API when ready.`,
      [{ text: "OK", onPress: () => navigation.goBack() }],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {def.name}
        </Text>
        <View style={{ width: 28 }} />
      </View>
      <Text style={styles.sub}>{def.description}</Text>
      <Text style={styles.meta}>
        {user?.full_name ?? user?.email ?? "You"} · {new Date().toLocaleString()}
      </Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        {def.fields.map((f) => {
          if (f.type === "check") {
            return (
              <View key={f.id} style={styles.row}>
                <Text style={styles.rowLabel}>{f.label}</Text>
                <Switch
                  value={checks[f.id] ?? false}
                  onValueChange={(v) => setChecks((s) => ({ ...s, [f.id]: v }))}
                  trackColor={{ true: colors.accentSoft, false: colors.border }}
                  thumbColor={checks[f.id] ? colors.accent : "#f4f4f5"}
                />
              </View>
            );
          }
          return (
            <View key={f.id} style={styles.noteBlock}>
              <Text style={styles.rowLabel}>{f.label}</Text>
              <TextInput
                value={notes[f.id] ?? ""}
                onChangeText={(t) => setNotes((s) => ({ ...s, [f.id]: t }))}
                placeholder={f.placeholder}
                placeholderTextColor={colors.textTertiary}
                style={styles.noteInput}
                multiline
              />
            </View>
          );
        })}

        <Pressable style={styles.photoBtn} onPress={() => void pickPhoto()}>
          <MaterialCommunityIcons name="camera" size={22} color={colors.accent} />
          <Text style={styles.photoTxt}>{photoUri ? "Photo captured" : "Add site photo"}</Text>
        </Pressable>

        <Pressable style={styles.submit} onPress={submit}>
          <Text style={styles.submitTxt}>Submit form</Text>
        </Pressable>
      </ScrollView>
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
  },
  topTitle: { flex: 1, ...typography.section, textAlign: "center" },
  sub: {
    paddingHorizontal: layout.screenPaddingH,
    marginTop: space.sm,
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  meta: {
    paddingHorizontal: layout.screenPaddingH,
    marginTop: 4,
    ...typography.caption,
    color: colors.textTertiary,
  },
  scroll: { padding: layout.screenPaddingH, paddingBottom: space.xxl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowLabel: { flex: 1, ...typography.body, color: colors.textPrimary, paddingRight: space.md },
  noteBlock: { marginTop: space.md },
  noteInput: {
    marginTop: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: space.md,
    minHeight: 80,
    textAlignVertical: "top",
    color: colors.textPrimary,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.lg,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  photoTxt: { ...typography.bodySm, fontWeight: "600", color: colors.accent },
  submit: {
    marginTop: space.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
