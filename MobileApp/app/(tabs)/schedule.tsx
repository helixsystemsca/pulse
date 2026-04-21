import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen } from "@/components/Screen";
import { useSession } from "@/store/session";
import { listShifts, listZones, type ShiftOut, type Zone } from "@/lib/api/schedule";
import { createWorkRequest } from "@/lib/api/workRequests";
import { patchWorkerProfile } from "@/lib/api/workers";

type AvailShiftKey = "morning" | "afternoon" | "night";
const AVAIL_SHIFT_LABELS: Record<AvailShiftKey, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  night: "Night",
};

function isoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export default function ScheduleScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const token = session?.token ?? "";

  const [tab, setTab] = useState<"schedule" | "projects" | "availability" | "timeoff">("schedule");
  const [rows, setRows] = useState<ShiftOut[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Availability / time-off
  const [availStep, setAvailStep] = useState<1 | 2>(1);
  const [availMonth, setAvailMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [availSelectedDates, setAvailSelectedDates] = useState<Set<string>>(() => new Set());
  const [availShiftsByDate, setAvailShiftsByDate] = useState<Record<string, AvailShiftKey[]>>({});

  const [timeOffStart, setTimeOffStart] = useState("");
  const [timeOffEnd, setTimeOffEnd] = useState("");
  const [timeOffReason, setTimeOffReason] = useState("");

  const zoneNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const z of zones) m.set(String(z.id), String(z.name));
    return m;
  }, [zones]);

  const myUserId = session?.user.id ?? "";

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const now = new Date();
      const from = new Date(now);
      from.setDate(now.getDate() - 7);
      const to = new Date(now);
      to.setDate(now.getDate() + 21);
      const [s, z] = await Promise.all([
        listShifts(token, { from: from.toISOString(), to: to.toISOString() }),
        listZones(token),
      ]);
      setRows(s);
      setZones(z);
    } catch (e) {
      setRows([]);
      setZones([]);
      setErr(e instanceof Error ? e.message : "Failed to load schedule");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const { myShifts, otherShifts, projectShifts } = useMemo(() => {
    const mine: ShiftOut[] = [];
    const other: ShiftOut[] = [];
    const proj: ShiftOut[] = [];
    for (const r of rows) {
      const isProj = String(r.shift_kind ?? "workforce") === "project_task" || Boolean(r.project_name);
      if (isProj) proj.push(r);
      if (String(r.assigned_user_id) === String(myUserId)) mine.push(r);
      else other.push(r);
    }
    return { myShifts: mine, otherShifts: other, projectShifts: proj };
  }, [rows, myUserId]);

  // MVP: show availability editor; later: conditionally show based on worker profile employment_type.
  const showAvailabilityTab = true;

  const monthTitle = useMemo(() => {
    try {
      return availMonth.toLocaleString(undefined, { month: "long", year: "numeric" });
    } catch {
      return `${availMonth.getFullYear()}-${String(availMonth.getMonth() + 1).padStart(2, "0")}`;
    }
  }, [availMonth]);

  const calendarCells = useMemo(() => {
    const first = startOfMonth(availMonth);
    const dow0 = first.getDay(); // 0=Sun
    const lead = dow0; // show Sunday-first calendar
    const totalDays = daysInMonth(availMonth);
    const cells: Array<{ kind: "empty" } | { kind: "day"; date: Date; iso: string }> = [];
    for (let i = 0; i < lead; i++) cells.push({ kind: "empty" });
    for (let d = 1; d <= totalDays; d++) {
      const dt = new Date(availMonth.getFullYear(), availMonth.getMonth(), d);
      cells.push({ kind: "day", date: dt, iso: isoDateOnly(dt) });
    }
    // pad to full weeks (6 rows max)
    while (cells.length % 7 !== 0) cells.push({ kind: "empty" });
    return cells;
  }, [availMonth]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Schedule</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body }}>
          Full schedule, optimized for mobile. Your shifts are highlighted.
        </Text>

        <View style={{ flexDirection: "row", marginTop: spacing.lg, gap: 10 }}>
          {(
            [
              ["schedule", "Schedule"],
              ["projects", "Projects"],
              ...(showAvailabilityTab ? [["availability", "Availability"]] : []),
              ["timeoff", "Time off"],
            ] as const
          ).map(([k, label]) => {
            const active = tab === k;
            return (
              <Pressable
                key={k}
                onPress={() => setTab(k as any)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: active ? colors.success : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: active ? "#0A0A0A" : colors.text, fontWeight: "900", fontSize: 12 }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {err ? (
          <View
            style={{
              marginTop: spacing.md,
              backgroundColor: "rgba(235,81,96,0.14)",
              borderColor: "rgba(235,81,96,0.35)",
              borderWidth: 1,
              borderRadius: radii.md,
              padding: 12,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>Schedule</Text>
            <Text style={{ marginTop: 4, color: colors.muted }}>{err}</Text>
            <Pressable onPress={() => void load()} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.success, fontWeight: "900" }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "schedule" ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.6 }}>
              YOUR SHIFTS
            </Text>
            <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              {(myShifts.length ? myShifts : []).map((s) => (
                <View
                  key={s.id}
                  style={{
                    backgroundColor: "rgba(54,241,205,0.14)",
                    borderColor: "rgba(54,241,205,0.45)",
                    borderWidth: 1,
                    borderRadius: radii.lg,
                    padding: spacing.lg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={2}>
                    {new Date(s.starts_at).toLocaleString()} – {new Date(s.ends_at).toLocaleTimeString()}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 6, fontWeight: "700" }}>
                    {s.display_label?.trim()
                      ? s.display_label
                      : s.zone_id
                        ? zoneNameById.get(String(s.zone_id)) ?? `Zone ${s.zone_id}`
                        : "No zone"}
                  </Text>
                </View>
              ))}
              {!myShifts.length ? (
                <Text style={{ color: colors.muted, marginTop: 8 }}>No shifts assigned in the current range.</Text>
              ) : null}
            </View>

            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.6, marginTop: spacing.lg }}>
              FULL SCHEDULE
            </Text>
            <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              {otherShifts.slice(0, 60).map((s) => (
                <View
                  key={s.id}
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radii.lg,
                    padding: spacing.lg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={2}>
                    {new Date(s.starts_at).toLocaleString()} – {new Date(s.ends_at).toLocaleTimeString()}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 6 }}>
                    {s.zone_id ? zoneNameById.get(String(s.zone_id)) ?? `Zone ${s.zone_id}` : "No zone"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {tab === "projects" ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.6 }}>
              PROJECTS
            </Text>
            <Text style={{ color: colors.muted, marginTop: 8 }}>
              Project work is shown when a project task is linked to a schedule shift.
            </Text>
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {projectShifts.slice(0, 80).map((s) => {
                const mine = String(s.assigned_user_id) === String(myUserId);
                return (
                  <View
                    key={s.id}
                    style={{
                      backgroundColor: mine ? "rgba(54,241,205,0.10)" : colors.card,
                      borderColor: mine ? "rgba(54,241,205,0.35)" : colors.border,
                      borderWidth: 1,
                      borderRadius: radii.lg,
                      padding: spacing.lg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={2}>
                      {s.project_name ?? "Project task"}
                    </Text>
                    <Text style={{ color: colors.muted, marginTop: 6 }}>
                      {new Date(s.starts_at).toLocaleString()} – {new Date(s.ends_at).toLocaleTimeString()}
                    </Text>
                    {s.task_priority ? (
                      <Text style={{ color: colors.muted, marginTop: 6, fontWeight: "700" }}>
                        Priority: {s.task_priority}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
              {!projectShifts.length ? (
                <Text style={{ color: colors.muted, marginTop: 8 }}>No project shifts found.</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {tab === "availability" && showAvailabilityTab ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.text, ...text.h2 }}>Availability</Text>
            <Text style={{ color: colors.muted, marginTop: 8 }}>
              Pick the days you can work, then choose which shifts you’re available for.
            </Text>

            {availStep === 1 ? (
              <View style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Pressable
                    onPress={() => setAvailMonth((m) => addMonths(m, -1))}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>‹</Text>
                  </Pressable>
                  <Text style={{ color: colors.text, fontWeight: "900" }}>{monthTitle}</Text>
                  <Pressable
                    onPress={() => setAvailMonth((m) => addMonths(m, 1))}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>›</Text>
                  </Pressable>
                </View>

                <View style={{ marginTop: spacing.md }}>
                  <View style={{ flexDirection: "row" }}>
                    {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                      <View key={d} style={{ width: `${100 / 7}%`, paddingVertical: 6 }}>
                        <Text style={{ color: colors.muted, textAlign: "center", fontWeight: "900", fontSize: 12 }}>
                          {d}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {calendarCells.map((c, idx) => {
                      if (c.kind === "empty") {
                        return <View key={`e-${idx}`} style={{ width: `${100 / 7}%`, padding: 6 }} />;
                      }
                      const selected = availSelectedDates.has(c.iso);
                      const dayNum = c.date.getDate();
                      return (
                        <View key={c.iso} style={{ width: `${100 / 7}%`, padding: 6 }}>
                          <Pressable
                            onPress={() => {
                              setAvailSelectedDates((prev) => {
                                const next = new Set(prev);
                                if (next.has(c.iso)) {
                                  next.delete(c.iso);
                                } else {
                                  next.add(c.iso);
                                }
                                return next;
                              });
                            }}
                            style={{
                              height: 40,
                              borderRadius: 12,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: selected ? colors.success : colors.surface,
                              borderWidth: 1,
                              borderColor: selected ? "rgba(54,241,205,0.55)" : colors.border,
                            }}
                          >
                            <Text style={{ color: selected ? "#0A0A0A" : colors.text, fontWeight: "900" }}>
                              {dayNum}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={{ marginTop: spacing.md, flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => {
                      setAvailSelectedDates(new Set());
                      setAvailShiftsByDate({});
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: radii.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>Clear</Text>
                  </Pressable>
                  <Pressable
                    disabled={availSelectedDates.size === 0}
                    onPress={() => {
                      // Initialize shift selections (default morning) for newly selected dates.
                      setAvailShiftsByDate((prev) => {
                        const next: Record<string, AvailShiftKey[]> = { ...prev };
                        for (const d of Array.from(availSelectedDates)) {
                          if (!next[d]) next[d] = ["morning"];
                        }
                        return next;
                      });
                      setAvailStep(2);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: radii.lg,
                      backgroundColor: colors.success,
                      alignItems: "center",
                      opacity: availSelectedDates.size === 0 ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>
                      Next ({availSelectedDates.size})
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => setAvailStep(1)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>← Back</Text>
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  <Pressable
                    disabled={!session || busy}
                    onPress={() => {
                      if (!session) return;
                      const dates = Array.from(availSelectedDates).sort();
                      const payload: Record<string, AvailShiftKey[]> = {};
                      for (const d of dates) {
                        const sh = availShiftsByDate[d] ?? [];
                        if (sh.length) payload[d] = sh;
                      }
                      setBusy(true);
                      void (async () => {
                        try {
                          await patchWorkerProfile(session.token, session.user.id, {
                            availability: {
                              version: 1,
                              dates: payload,
                            },
                          });
                          Alert.alert("Availability", "Saved");
                        } catch (e) {
                          Alert.alert("Availability", e instanceof Error ? e.message : "Save failed");
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      backgroundColor: colors.success,
                      opacity: !session || busy ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>{busy ? "Saving…" : "Save"}</Text>
                  </Pressable>
                </View>

                <Text style={{ color: colors.muted, marginTop: spacing.md }}>
                  Choose shifts for each selected date.
                </Text>

                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  {Array.from(availSelectedDates)
                    .sort()
                    .map((d) => {
                      const cur = availShiftsByDate[d] ?? [];
                      return (
                        <View
                          key={d}
                          style={{
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderWidth: 1,
                            borderRadius: radii.lg,
                            padding: spacing.lg,
                          }}
                        >
                          <Text style={{ color: colors.text, fontWeight: "900" }}>{d}</Text>
                          <View style={{ flexDirection: "row", marginTop: spacing.sm, gap: 10 }}>
                            {(Object.keys(AVAIL_SHIFT_LABELS) as AvailShiftKey[]).map((k) => {
                              const on = cur.includes(k);
                              return (
                                <Pressable
                                  key={k}
                                  onPress={() => {
                                    setAvailShiftsByDate((prev) => {
                                      const next = { ...prev };
                                      const now = new Set<AvailShiftKey>(next[d] ?? []);
                                      if (now.has(k)) now.delete(k);
                                      else now.add(k);
                                      next[d] = Array.from(now);
                                      return next;
                                    });
                                  }}
                                  style={{
                                    flex: 1,
                                    paddingVertical: 10,
                                    borderRadius: 12,
                                    backgroundColor: on ? colors.success : colors.surface,
                                    borderWidth: 1,
                                    borderColor: on ? "rgba(54,241,205,0.55)" : colors.border,
                                    alignItems: "center",
                                  }}
                                >
                                  <Text style={{ color: on ? "#0A0A0A" : colors.text, fontWeight: "900", fontSize: 12 }}>
                                    {AVAIL_SHIFT_LABELS[k]}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                </View>
              </View>
            )}
          </View>
        ) : null}

        {tab === "timeoff" ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.text, ...text.h2 }}>Request time off</Text>
            <Text style={{ color: colors.muted, marginTop: 8 }}>
              This creates a work request for managers to review (simple MVP).
            </Text>

            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <TextInput
                value={timeOffStart}
                onChangeText={setTimeOffStart}
                placeholder="Start date (e.g. 2026-05-01)"
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
              <TextInput
                value={timeOffEnd}
                onChangeText={setTimeOffEnd}
                placeholder="End date (e.g. 2026-05-03)"
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
              <TextInput
                value={timeOffReason}
                onChangeText={setTimeOffReason}
                placeholder="Reason / notes"
                placeholderTextColor={colors.muted}
                multiline
                style={{
                  minHeight: 90,
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  color: colors.text,
                  textAlignVertical: "top",
                }}
              />

              <Pressable
                disabled={!session || busy}
                onPress={() => {
                  if (!session) return;
                  const title = `Time off request: ${timeOffStart || "?"} → ${timeOffEnd || "?"}`;
                  const desc = [timeOffReason?.trim() ? `Reason: ${timeOffReason.trim()}` : null]
                    .filter(Boolean)
                    .join("\n");
                  setBusy(true);
                  void (async () => {
                    try {
                      await createWorkRequest(session.token, {
                        title,
                        description: desc || null,
                        category: "time_off",
                        priority: "medium",
                      });
                      Alert.alert("Time off", "Request submitted");
                      setTimeOffStart("");
                      setTimeOffEnd("");
                      setTimeOffReason("");
                    } catch (e) {
                      Alert.alert("Time off", e instanceof Error ? e.message : "Submit failed");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
                style={{
                  marginTop: spacing.md,
                  backgroundColor: colors.success,
                  borderRadius: radii.lg,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>{busy ? "Submitting…" : "Submit request"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

