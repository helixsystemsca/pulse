import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { search, type SearchResultItem, type SearchResults } from "@/lib/api/search";
import { Screen } from "@/components/Screen";

const KIND_ICONS: Record<string, string> = {
  tool: "🔧",
  equipment: "⚙️",
  procedure: "📋",
  work_request: "📝",
};

const KIND_LABELS: Record<string, string> = {
  tool: "Tool",
  equipment: "Equipment",
  procedure: "Procedure",
  work_request: "Work Request",
};

const QUICK_FINDS = [
  { label: "My Tools", q: "tool" },
  { label: "Equipment", q: "equipment" },
  { label: "Procedures", q: "procedure" },
];

export default function SearchScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const token = session?.token ?? "";

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const initial = typeof params.q === "string" ? params.q : "";
    if (initial && !q) setQ(initial);
    // Only run once on mount/param change; avoid overwriting user typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  const doSearch = useCallback(
    async (query: string) => {
      if (!token || !query.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        setResults(await search(token, query.trim()));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => void doSearch(q), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, doSearch]);

  const allResults = useMemo<SearchResultItem[]>(() => {
    if (!results) return [];
    return [...results.tools, ...results.equipment, ...results.procedures, ...results.work_requests];
  }, [results]);

  const handleTap = (item: SearchResultItem) => {
    switch (item.kind) {
      case "tool":
        router.push("/(tabs)/search" as never);
        break;
      case "equipment":
        router.push("/(tabs)/tasks" as never);
        break;
      case "procedure":
        router.push("/(tabs)/documents" as never);
        break;
      case "work_request":
        router.push("/(tabs)/tasks" as never);
        break;
      default:
        break;
    }
  };

  return (
    <Screen>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Text style={{ color: colors.text, ...text.h1, marginBottom: spacing.md }}>Search</Text>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Tools, equipment, procedures…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={{
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 16,
          }}
        />

        {!q.trim() ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md }}>
            {QUICK_FINDS.map((qf) => (
              <Pressable
                key={qf.q}
                onPress={() => setQ(qf.q)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 12 }}>{qf.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={colors.success} />
          </View>
        ) : null}

        {err && !loading ? (
          <Text style={{ color: colors.danger, marginTop: spacing.md }}>{err}</Text>
        ) : null}

        {!q.trim() && !loading ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 }}>
              SEARCH FOR ANYTHING
            </Text>
            <Text style={{ color: colors.muted }}>
              Find tools by name or location, equipment by zone, procedures by title, or work requests by keyword.
            </Text>
          </View>
        ) : null}

        {results && !loading ? (
          <>
            {results.total === 0 ? (
              <Text style={{ color: colors.muted, marginTop: spacing.md, textAlign: "center" }}>
                No results for "{q}"
              </Text>
            ) : null}

            {allResults.map((item) => (
              <Pressable
                key={`${item.kind}-${item.id}`}
                onPress={() => handleTap(item)}
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  marginBottom: spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 22 }}>{KIND_ICONS[item.kind] ?? "📄"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{item.subtitle}</Text>
                  ) : null}
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900" }}>
                    {KIND_LABELS[item.kind]}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
