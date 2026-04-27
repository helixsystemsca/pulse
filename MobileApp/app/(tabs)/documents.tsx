import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { listMyProcedureAssignments, type ProcedureAssignmentRow } from "@/lib/api/procedures";
import { listBlueprints, type BlueprintSummary } from "@/lib/api/blueprints";
import { Screen } from "@/components/Screen";

type DocTab = "procedures" | "drawings" | "logs";

export default function DocumentsScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const router = useRouter();
  const token = session?.token ?? "";

  const [tab, setTab] = useState<DocTab>("procedures");
  const [procedures, setProcedures] = useState<ProcedureAssignmentRow[]>([]);
  const [drawings, setDrawings] = useState<BlueprintSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [procs, bps] = await Promise.allSettled([listMyProcedureAssignments(token), listBlueprints(token)]);
      if (procs.status === "fulfilled") setProcedures(procs.value);
      if (bps.status === "fulfilled") setDrawings(bps.value);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredProcedures = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return procedures;
    return procedures.filter((p) => (p.procedure_title ?? "").toLowerCase().includes(s));
  }, [procedures, q]);

  const filteredDrawings = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return drawings;
    return drawings.filter((d) => (d.name ?? "").toLowerCase().includes(s));
  }, [drawings, q]);

  const TABS: { key: DocTab; label: string }[] = [
    { key: "procedures", label: `Procedures (${procedures.length})` },
    { key: "drawings", label: `Drawings (${drawings.length})` },
    { key: "logs", label: "Logs" },
  ];

  return (
    <Screen>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Documents</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body }}>Procedures, drawings, and activity logs.</Text>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search…"
          placeholderTextColor={colors.muted}
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
          }}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: spacing.sm }}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: active ? colors.success : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.success : colors.border,
                  }}
                >
                  <Text style={{ color: active ? "#0A0A0A" : colors.muted, fontWeight: "900", fontSize: 12 }}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={colors.success} />
          </View>
        ) : null}

        {err && !loading ? (
          <View
            style={{
              backgroundColor: "rgba(235,81,96,0.12)",
              borderColor: "rgba(235,81,96,0.35)",
              borderWidth: 1,
              borderRadius: radii.md,
              padding: 12,
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>Could not load</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>{err}</Text>
            <Pressable onPress={() => void load()} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.success, fontWeight: "900" }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "procedures" && !loading ? (
          <View style={{ gap: spacing.sm }}>
            {filteredProcedures.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: "center", marginTop: 20 }}>No procedures assigned.</Text>
            ) : null}
            {filteredProcedures.map((p) => {
              const isOverdue = p.status === "pending";
              return (
                <Pressable
                  key={p.id}
                  onPress={() =>
                    router.push({
                      pathname: "/procedure-assignment",
                      params: { id: p.id },
                    } as never)
                  }
                  style={{
                    backgroundColor: colors.card,
                    borderColor: isOverdue ? "rgba(242,187,5,0.4)" : colors.border,
                    borderWidth: 1,
                    borderRadius: radii.lg,
                    padding: spacing.lg,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15, flex: 1 }} numberOfLines={2}>
                      {p.procedure_title}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor:
                          p.status === "completed" ? "rgba(54,241,205,0.12)" : "rgba(242,187,5,0.12)",
                      }}
                    >
                      <Text
                        style={{
                          color: p.status === "completed" ? colors.success : "#F2BB05",
                          fontWeight: "900",
                          fontSize: 10,
                          textTransform: "uppercase",
                        }}
                      >
                        {p.status === "in_progress" ? "In progress" : p.status === "pending" ? "Pending" : "Done"}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>
                    {p.kind === "revise"
                      ? "Revision requested"
                      : p.kind === "create"
                        ? "Create requested"
                        : "Completion requested"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {tab === "drawings" && !loading ? (
          <View style={{ gap: spacing.sm }}>
            {filteredDrawings.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: "center", marginTop: 20 }}>No drawings found.</Text>
            ) : null}
            {filteredDrawings.map((bp) => (
              <Pressable
                key={bp.id}
                onPress={() => router.push(`/blueprint?id=${encodeURIComponent(bp.id)}` as Href)}
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 24 }}>🗺</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                    {bp.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                    Saved {new Date(bp.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={{ color: colors.muted }}>›</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {tab === "logs" && !loading ? (
          <View style={{ gap: spacing.sm }}>
            <LogsPanel token={token} colors={colors} radii={radii} spacing={spacing} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

type LogEntry = {
  id: string;
  title: string;
  event_type: string;
  created_at: string;
};

function LogsPanel({
  token,
  colors,
  radii,
  spacing,
}: {
  token: string;
  colors: ReturnType<typeof useTheme>["colors"];
  radii: ReturnType<typeof useTheme>["radii"];
  spacing: ReturnType<typeof useTheme>["spacing"];
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    // TODO: replace with real logs endpoint when available
    setLoading(false);
    setLogs([]);
  }, [token]);

  if (loading) return <ActivityIndicator color={colors.success} />;

  if (logs.length === 0) {
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.lg,
          padding: spacing.lg,
        }}
      >
        <Text style={{ color: colors.muted, fontWeight: "800" }}>Activity logs coming soon.</Text>
        <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>
          Completed tasks, PM confirmations, and inspection records will appear here.
        </Text>
      </View>
    );
  }

  return (
    <>
      {logs.map((l) => (
        <View
          key={l.id}
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radii.lg,
            padding: spacing.lg,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>{l.title}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{new Date(l.created_at).toLocaleString()}</Text>
        </View>
      ))}
    </>
  );
}

