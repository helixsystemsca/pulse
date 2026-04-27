# Mobile Phase M2 — Tasks + Inference Confirmation Screen
# handoff/M2integration.md

## CURSOR PROMPT
"Read handoff/M2integration.md and handoff/contracts.md.
Execute steps in order. Check file exists before creating.
All changes are inside MobileApp/. Commit with message provided."

---

## WHAT EXISTS (do not recreate)
- tasks.tsx — exists, fetches listMyTasks + completeTask, shows XP/level
- task-detail.tsx — exists but may be incomplete
- ProximityPromptBanner.tsx — renders inference banner, BLE hook is mock
- subscribePulseWs in lib/realtime/pulseWs.ts — use for inference events
- apiFetch(path, {method?, body?, token?}) in lib/api/client.ts

---

## STEP 1 — Add inference API calls

=== FILE: MobileApp/lib/api/inference.ts ===

```ts
import { apiFetch } from "./client";

export type InferenceDetail = {
  inference_id: string;
  worker_name: string;
  asset_name: string;
  confidence: number;
  pm_name: string | null;
  pm_overdue_days: number;
  work_order_id: string | null;
  status: "pending" | "confirmed" | "dismissed" | "expired";
  evidence: Array<{ label: string; matched: boolean }>;
};

export async function confirmInference(token: string, inferenceId: string, note?: string): Promise<void> {
  await apiFetch<void>(`/api/v1/telemetry/inferences/${encodeURIComponent(inferenceId)}/confirm`, {
    method: "POST",
    token,
    body: note ? { note } : undefined,
  });
}

export async function dismissInference(token: string, inferenceId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/telemetry/inferences/${encodeURIComponent(inferenceId)}/dismiss`, {
    method: "POST",
    token,
  });
}
```

---

## STEP 2 — Inference confirmation full screen

=== FILE: MobileApp/app/inference-confirm.tsx ===

```tsx
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
  try { evidence = JSON.parse(params.evidence ?? "[]"); } catch { evidence = []; }

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
          <Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>
            Zero manual entry. Good work.
          </Text>
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

        {/* Asset info */}
        <View style={{
          backgroundColor: colors.card, borderColor: colors.border,
          borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg,
          marginBottom: spacing.md,
        }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>
            {params.asset_name}
          </Text>
          {params.pm_name ? (
            <Text style={{ color: colors.muted, marginTop: 6, fontWeight: "700" }}>
              {params.pm_name}
            </Text>
          ) : null}
          {overdueDays > 0 ? (
            <View style={{
              marginTop: 10, flexDirection: "row", alignItems: "center",
              backgroundColor: "rgba(235,81,96,0.12)",
              borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 6,
              alignSelf: "flex-start", gap: 6,
            }}>
              <Text style={{ color: colors.danger, fontWeight: "900", fontSize: 12 }}>
                ⚠ {overdueDays} day{overdueDays !== 1 ? "s" : ""} overdue
              </Text>
            </View>
          ) : null}
        </View>

        {/* Why Pulse thinks this */}
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", marginBottom: 8, letterSpacing: 0.8 }}>
          WHY PULSE DETECTED THIS
        </Text>
        <View style={{
          backgroundColor: colors.card, borderColor: colors.border,
          borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg,
          marginBottom: spacing.md, gap: 8,
        }}>
          {evidence.length > 0 ? evidence.map((e, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 14 }}>{e.matched ? "✓" : "✗"}</Text>
              <Text style={{ color: e.matched ? colors.text : colors.muted, fontWeight: "700" }}>
                {e.label}
              </Text>
            </View>
          )) : (
            <>
              <Text style={{ color: colors.text, fontWeight: "700" }}>✓ Near this equipment for 60+ seconds</Text>
              <Text style={{ color: colors.text, fontWeight: "700" }}>✓ You are on shift</Text>
              <Text style={{ color: colors.text, fontWeight: "700" }}>✓ PM is overdue</Text>
            </>
          )}
        </View>

        {/* Confidence bar */}
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", marginBottom: 8, letterSpacing: 0.8 }}>
          CONFIDENCE
        </Text>
        <View style={{
          backgroundColor: colors.card, borderColor: colors.border,
          borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg,
          marginBottom: spacing.xl,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: colors.muted, fontWeight: "700" }}>Match score</Text>
            <Text style={{ color: colors.success, fontWeight: "900" }}>{confidence}%</Text>
          </View>
          <View style={{ height: 8, backgroundColor: colors.surface, borderRadius: 4, overflow: "hidden" }}>
            <View style={{
              height: "100%", width: `${confidence}%`,
              backgroundColor: confidence >= 90 ? colors.success : confidence >= 70 ? "#F2BB05" : colors.muted,
              borderRadius: 4,
            }} />
          </View>
        </View>

        {/* Optional note */}
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
            minHeight: 80, padding: spacing.md, borderRadius: radii.lg,
            borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.surface, color: colors.text,
            textAlignVertical: "top", marginBottom: spacing.lg,
          }}
        />

        {/* Actions */}
        <Pressable
          disabled={busy}
          onPress={handleConfirm}
          style={{
            backgroundColor: colors.success, borderRadius: radii.lg,
            paddingVertical: 16, alignItems: "center",
            marginBottom: spacing.md, opacity: busy ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#0A0A0A", fontWeight: "900", fontSize: 16 }}>
            {busy ? "Logging…" : "✓ Yes, I'm working on this"}
          </Text>
        </Pressable>

        <Pressable
          disabled={busy}
          onPress={handleDismiss}
          style={{
            backgroundColor: colors.surface, borderRadius: radii.lg,
            borderWidth: 1, borderColor: colors.border,
            paddingVertical: 16, alignItems: "center",
            opacity: busy ? 0.7 : 1,
          }}
        >
          <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 16 }}>
            Not now — dismiss
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
```

---

## STEP 3 — Wire ProximityPromptBanner to inference screen

=== MODIFY: MobileApp/components/ProximityPromptBanner.tsx ===

ACTION: wire the banner tap to navigate to inference-confirm screen
and subscribe to real WS inference events alongside mock BLE

Find the component. It currently uses useBLE() for mock events.
Add WS subscription for real inference events:

```tsx
import { useRouter } from "expo-router";
import { useSession } from "@/store/session";
import { subscribePulseWs, type PulseWsEvent } from "@/lib/realtime/pulseWs";

// Inside the component:
const router = useRouter();
const { session } = useSession();

// Add alongside existing useBLE effect:
useEffect(() => {
  if (!session?.token) return;
  return subscribePulseWs(session.token, (evt: PulseWsEvent) => {
    if (
      evt.event_type === "maintenance_inference_request" ||
      evt.event_type === "demo_inference_fired"
    ) {
      const meta = evt.metadata ?? {};
      setInferencePayload({
        inference_id: String(meta.inference_id ?? evt.entity_id ?? ""),
        asset_name: String(meta.asset_name ?? "Unknown asset"),
        pm_name: meta.pm_name ? String(meta.pm_name) : undefined,
        pm_overdue_days: Number(meta.pm_overdue_days ?? 0),
        confidence: Number(meta.confidence ?? 0),
        work_order_id: meta.work_order_id ? String(meta.work_order_id) : undefined,
      });
    }
  });
}, [session?.token]);
```

Add state for inference payload:
```tsx
const [inferencePayload, setInferencePayload] = useState<{
  inference_id: string;
  asset_name: string;
  pm_name?: string;
  pm_overdue_days: number;
  confidence: number;
  work_order_id?: string;
} | null>(null);
```

Wire the "Confirm" button on the banner to navigate:
```tsx
onPress={() => {
  if (!inferencePayload) return;
  router.push({
    pathname: "/inference-confirm",
    params: {
      inference_id: inferencePayload.inference_id,
      asset_name: inferencePayload.asset_name,
      pm_name: inferencePayload.pm_name ?? "",
      pm_overdue_days: String(inferencePayload.pm_overdue_days),
      confidence: String(inferencePayload.confidence),
      work_order_id: inferencePayload.work_order_id ?? "",
    },
  } as never);
  setInferencePayload(null);
}}
```

If the existing ProximityPromptBanner already has confirm/dismiss props,
adapt this pattern to fit — don't rewrite the whole component.
Use TODO if the existing component structure is unclear.

---

## STEP 4 — Rebuild Tasks screen

=== MODIFY: MobileApp/app/(tabs)/tasks.tsx ===

ACTION: add tabs (Mine/Open/Completed), priority badges, due date urgency

Replace the existing Tasks screen content with:

```tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { listMyTasks, type Task } from "@/lib/api/tasks";
import { Screen } from "@/components/Screen";

type TabKey = "mine" | "completed";

function priorityColor(p: string | undefined, colors: ReturnType<typeof useTheme>["colors"]): string {
  if (p === "critical") return colors.danger;
  if (p === "high") return "#F97316";
  if (p === "medium") return "#F2BB05";
  return colors.muted;
}

function isOverdue(due: string | undefined): boolean {
  if (!due) return false;
  return new Date(due) < new Date();
}

function fmtDue(due: string | undefined): string {
  if (!due) return "No due date";
  const d = new Date(due);
  if (isOverdue(due)) {
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return days === 0 ? "Due today" : `${days}d overdue`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TasksScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("mine");
  const [rows, setRows] = useState<Task[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    try { setRows(await listMyTasks(session.token)); } catch { setRows([]); }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  const mine = useMemo(() => rows.filter(r => r.status !== "done"), [rows]);
  const completed = useMemo(() => rows.filter(r => r.status === "done"), [rows]);
  const list = tab === "completed" ? completed : mine;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Tasks</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body, marginBottom: spacing.lg }}>
          Work orders, PMs, and routines assigned to you.
        </Text>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: spacing.lg }}>
          {([
            { key: "mine" as const, label: `Open (${mine.length})` },
            { key: "completed" as const, label: `Completed (${completed.length})` },
          ]).map(t => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 999,
                  alignItems: "center",
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

        <View style={{ gap: spacing.sm }}>
          {list.length === 0 && (
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: 20 }}>
              {tab === "completed" ? "No completed tasks yet." : "Nothing assigned right now."}
            </Text>
          )}
          {list.map(t => {
            const overdue = isOverdue(t.due_date);
            return (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: "/task-detail", params: { id: t.id } } as never)}
                style={{
                  backgroundColor: colors.card,
                  borderColor: overdue ? "rgba(235,81,96,0.4)" : colors.border,
                  borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15, flex: 1 }} numberOfLines={2}>
                    {t.title}
                  </Text>
                  {t.priority && (
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
                      backgroundColor: priorityColor(t.priority, colors) + "22",
                      borderWidth: 1, borderColor: priorityColor(t.priority, colors) + "55",
                    }}>
                      <Text style={{ color: priorityColor(t.priority, colors), fontWeight: "900", fontSize: 10, textTransform: "uppercase" }}>
                        {t.priority}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: overdue ? colors.danger : colors.muted, marginTop: 6, fontSize: 12, fontWeight: "800" }}>
                  {overdue ? "⚠ " : ""}{fmtDue(t.due_date)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === "mine" && (
          <Pressable
            onPress={() => router.push("/new-work-request" as never)}
            style={{
              marginTop: spacing.lg, backgroundColor: colors.success,
              borderRadius: radii.lg, paddingVertical: 14, alignItems: "center",
            }}
          >
            <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>+ Create work request</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}
```

---

## EXECUTION STEPS
1. Create MobileApp/lib/api/inference.ts
2. Create MobileApp/app/inference-confirm.tsx
3. Modify MobileApp/components/ProximityPromptBanner.tsx — WS wiring + navigate to inference-confirm
4. Modify MobileApp/app/(tabs)/tasks.tsx — tabs, priority badges, urgency
5. git add -A && git commit -m "feat(mobile/M2): inference confirmation screen, WS-driven banner, tasks rebuild"

---

## VALIDATION
- [ ] Inference banner fires from real WS event (demo_inference_fired)
- [ ] Tapping banner navigates to inference-confirm screen
- [ ] Confirm screen shows asset name, PM details, evidence, confidence bar
- [ ] Confirming calls /inferences/{id}/confirm and shows success state
- [ ] Dismissing calls /inferences/{id}/dismiss and goes back
- [ ] Tasks screen shows Mine/Completed tabs
- [ ] Overdue tasks show red border and warning label
- [ ] Priority badges render correctly

---

## UPDATE handoff/current_state.md
- Add: Mobile M2 — inference confirmation screen, WS-driven banner, tasks rebuild
- Update Pending: M3, M4, M5, M6 remaining
git add handoff/current_state.md
git commit -m "chore: update current_state after mobile M2"
