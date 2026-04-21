import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen } from "@/components/Screen";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useSession } from "@/store/session";
import { listBlueprints, type BlueprintSummary } from "@/lib/api/blueprints";

export default function DrawingsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const token = session?.token ?? "";
  const { colors, radii, spacing, text } = useTheme();

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<BlueprintSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const bps = await listBlueprints(token);
      setRows(bps);
    } catch (e) {
      setRows([]);
      setErr(e instanceof Error ? e.message : "Failed to load drawings");
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => String(r.name || "").toLowerCase().includes(s));
  }, [q, rows]);

  return (
    <Screen>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Drawings</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body }}>
          Choose a saved drawing, then open a mobile-friendly view.
        </Text>

        <View style={{ marginTop: spacing.md }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search drawings…"
            placeholderTextColor={colors.muted}
            style={{
              padding: spacing.md,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.text,
            }}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 110 }}>
        {busy ? (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator color={colors.success} />
          </View>
        ) : null}
        {err ? (
          <View
            style={{
              backgroundColor: "rgba(235,81,96,0.14)",
              borderColor: "rgba(235,81,96,0.35)",
              borderWidth: 1,
              borderRadius: radii.md,
              padding: 12,
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>Drawings</Text>
            <Text style={{ marginTop: 4, color: colors.muted }}>{err}</Text>
            <Pressable onPress={() => void load()} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.success, fontWeight: "900" }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          {filtered.map((bp) => (
            <Pressable
              key={bp.id}
              onPress={() => router.push(`/blueprint?id=${encodeURIComponent(bp.id)}` as Href)}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radii.lg,
                padding: spacing.lg,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={2}>
                {bp.name}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12, fontWeight: "700" }}>
                Saved {new Date(bp.created_at).toLocaleDateString()}
              </Text>
            </Pressable>
          ))}
          {!busy && !filtered.length ? (
            <Text style={{ color: colors.muted, marginTop: 8 }}>No drawings found.</Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

