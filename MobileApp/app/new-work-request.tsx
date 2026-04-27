import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { createWorkRequest } from "@/lib/api/workRequests";
import { Screen } from "@/components/Screen";

export default function NewWorkRequestScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [busy, setBusy] = useState(false);

  const PRIORITIES = ["low", "medium", "high", "critical"] as const;

  const submit = async () => {
    if (!session || !title.trim()) return;
    setBusy(true);
    try {
      await createWorkRequest(session.token, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
      });
      Alert.alert("Work request created", "Your request has been submitted.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.lg, gap: 12 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.success, fontWeight: "900", fontSize: 16 }}>←</Text>
          </Pressable>
          <Text style={{ color: colors.text, ...text.h1 }}>New work request</Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 }}>
              TITLE
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What needs attention?"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radii.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: 12,
                color: colors.text,
                fontWeight: "700",
              }}
            />
          </View>

          <View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 }}>
              DETAILS
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add details (optional)"
              placeholderTextColor={colors.muted}
              multiline
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radii.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: 12,
                minHeight: 120,
                color: colors.text,
                textAlignVertical: "top",
              }}
            />
          </View>

          <View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 }}>
              PRIORITY
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    borderColor: p === priority ? colors.success : colors.border,
                    backgroundColor: p === priority ? colors.surface : colors.card,
                  }}
                >
                  <Text style={{ color: p === priority ? colors.text : colors.muted, fontWeight: "900", fontSize: 12 }}>
                    {p.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => void submit()}
            disabled={busy || !title.trim()}
            style={{
              backgroundColor: colors.success,
              borderRadius: radii.lg,
              paddingVertical: 14,
              alignItems: "center",
              opacity: busy || !title.trim() ? 0.5 : 1,
            }}
          >
            <Text style={{ color: "#0A0A0A", fontWeight: "900", fontSize: 14 }}>
              {busy ? "Submitting…" : "Submit"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

