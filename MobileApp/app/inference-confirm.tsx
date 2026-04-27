import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { confirmInference, dismissInference } from "@/lib/api/inference";
import { Screen } from "@/components/Screen";

export default function InferenceConfirmScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{
    inference_id: string;
    asset_name: string;
    pm_name?: string;
    pm_overdue_days?: string;
    confidence?: string;
    work_order_id?: string;
    evidence?: string; // JSON string of {label, matched}[]
  }>();

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const confidence = Math.round(Number(params.confidence ?? 0) * 100);
  const overdueDays = Number(params.pm_overdue_days ?? 0);

  let evidence: Array<{ label: string; matched: boolean }> = [];
  try {
    evidence = JSON.parse(params.evidence ?? "[]");
  } catch {
    evidence = [];
  }

  const handleConfirm = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await confirmInference(session.token, params.inference_id, note.trim() || undefined);
      setConfirmed(true);
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to confirm");
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await dismissInference(session.token, params.inference_id);
      router.back();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to dismiss");
    } finally {
      setBusy(false);
    }
  };

  if (confirmed) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
          <Text style={{ fontSize: 48 }}>✅</Text>
          <Text style={{ color: colors.text, ...text.h1, marginTop: spacing.lg, textAlign: "center" }}>
            Work order logged
          </Text>
          <Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>Zero manual entry. Good work.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.lg, gap: 12 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.success, fontWeight: "900", fontSize: 16 }}>←</Text>
          </Pressable>
          <Text style={{ color: colors.text, ...text.h1 }}>Maintenance Detected</Text>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radii.lg,
            padding: spacing.lg,
            marginBottom: spacing.md,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>{params.asset_name}</Text>
          {params.pm_name ? <Text style={{ color: colors.muted, marginTop: 6, fontWeight: "700" }}>{params.pm_name}</Text> : null}
          {overdueDays > 0 ? (
            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(235,81,96,0.12)",
                borderRadius: radii.md,
                paddingHorizontal: 10,
                paddingVertical: 6,
                alignSelf: "flex-start",
                gap: 6,
              }}
            >
              <Text style={{ color: colors.danger, fontWeight: "900", fontSize: 12 }}>
                ⚠ {overdueDays} day{overdueDays !== 1 ? "s" : ""} overdue
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", marginBottom: 8, letterSpacing: 0.8 }}>
          WHY PULSE DETECTED THIS
        </Text>
        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radii.lg,
            padding: spacing.lg,
            marginBottom: spacing.md,
            gap: 8,
          }}
        >
          {evidence.length > 0 ? (
            evidence.map((e, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 14 }}>{e.matched ? "✓" : "✗"}</Text>
                <Text style={{ color: e.matched ? colors.text : colors.muted, fontWeight: "700" }}>{e.label}</Text>
              </View>
            ))
          ) : (
            <>
              <Text style={{ color: colors.text, fontWeight: "700" }}>✓ Near this equipment for 60+ seconds</Text>
              <Text style={{ color: colors.text, fontWeight: "700" }}>✓ You are on shift</Text>
              <Text style={{ color: colors.text, fontWeight: "700" }}>✓ PM is overdue</Text>
            </>
          )}
        </View>

        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", marginBottom: 8, letterSpacing: 0.8 }}>
          CONFIDENCE
        </Text>
        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radii.lg,
            padding: spacing.lg,
            marginBottom: spacing.xl,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: colors.muted, fontWeight: "700" }}>Match score</Text>
            <Text style={{ color: colors.success, fontWeight: "900" }}>{confidence}%</Text>
          </View>
          <View style={{ height: 8, backgroundColor: colors.surface, borderRadius: 4, overflow: "hidden" }}>
            <View
              style={{
                height: "100%",
                width: `${confidence}%`,
                backgroundColor: confidence >= 90 ? colors.success : confidence >= 70 ? "#F2BB05" : colors.muted,
                borderRadius: 4,
              }}
            />
          </View>
        </View>

        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", marginBottom: 8, letterSpacing: 0.8 }}>
          ADD A NOTE (OPTIONAL)
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What did you do? Any observations?"
          placeholderTextColor={colors.muted}
          multiline
          style={{
            minHeight: 80,
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            textAlignVertical: "top",
            marginBottom: spacing.lg,
          }}
        />

        <Pressable
          disabled={busy}
          onPress={handleConfirm}
          style={{
            backgroundColor: colors.success,
            borderRadius: radii.lg,
            paddingVertical: 16,
            alignItems: "center",
            marginBottom: spacing.md,
            opacity: busy ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#0A0A0A", fontWeight: "900", fontSize: 16 }}>{busy ? "Logging…" : "✓ Yes, I'm working on this"}</Text>
        </Pressable>

        <Pressable
          disabled={busy}
          onPress={handleDismiss}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 16,
            alignItems: "center",
            opacity: busy ? 0.7 : 1,
          }}
        >
          <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 16 }}>Not now — dismiss</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

