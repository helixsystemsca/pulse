import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen } from "@/components/Screen";
import { useSession } from "@/store/session";
import { fetchAuthenticatedImageAsDataUri } from "@/lib/fetchAuthenticatedImageDataUri";
import {
  completeProcedureAssignment,
  getProcedureAssignment,
  patchProcedure,
  uploadProcedureStepImage,
  uploadProcedureAssignmentPhoto,
  type ProcedureAssignmentDetail,
} from "@/lib/api/procedures";

type DraftStep = { key: string; text: string; image_url: string | null };

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ProcedureAssignmentScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const router = useRouter();
  const rawId = useLocalSearchParams<{ id?: string }>().id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const { session } = useSession();
  const token = session?.token ?? "";

  const [data, setData] = useState<ProcedureAssignmentDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyUpload, setBusyUpload] = useState(false);
  const [busyComplete, setBusyComplete] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});
  const [stepImageUris, setStepImageUris] = useState<Record<string, string>>({});
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([]);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setErr(null);
    try {
      const row = await getProcedureAssignment(token, String(id));
      setData(row);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "Failed to load procedure");
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.photos?.length || !token) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const ph of data.photos) {
        const uri = await fetchAuthenticatedImageAsDataUri(ph.url, token);
        if (uri) next[ph.id] = uri;
      }
      if (!cancelled) setPhotoUris(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.photos, token]);

  useEffect(() => {
    if (!data?.procedure?.steps?.length || !token) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      const procId = data.procedure.id;
      for (let i = 0; i < data.procedure.steps.length; i++) {
        const s = data.procedure.steps[i];
        const url = (s?.image_url ?? "").trim();
        if (!url) continue;
        const uri = await fetchAuthenticatedImageAsDataUri(url, token);
        if (uri) next[`${procId}:${i}`] = uri;
      }
      if (!cancelled) setStepImageUris(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.procedure?.id, data?.procedure?.steps, token]);

  const title = data?.procedure?.title || data?.procedure_title || "Procedure";
  const steps = data?.procedure?.steps ?? [];
  const canComplete = Boolean(data && data.status !== "completed");
  const canEditSteps = Boolean(data && (data.kind === "revise" || data.kind === "create") && data.status !== "completed");
  const isRunnerMode = Boolean(data && data.kind === "complete" && !canEditSteps);

  const [runnerIndex, setRunnerIndex] = useState(0);
  const [runnerDone, setRunnerDone] = useState<boolean[]>([]);

  useEffect(() => {
    if (!steps.length) {
      setRunnerIndex(0);
      setRunnerDone([]);
      return;
    }
    setRunnerIndex(0);
    setRunnerDone((prev) => (prev.length === steps.length ? prev : Array.from({ length: steps.length }, () => false)));
  }, [data?.procedure?.id, data?.procedure?.updated_at, steps.length]);

  const allStepsDone = useMemo(() => (steps.length ? runnerDone.length === steps.length && runnerDone.every(Boolean) : true), [
    runnerDone,
    steps.length,
  ]);

  const statusLabel = useMemo(() => {
    if (!data) return "";
    if (data.status === "completed") return "Completed";
    if (data.status === "in_progress") return "In progress";
    return "Pending";
  }, [data]);

  const kindLine = useMemo(() => {
    if (!data) return "";
    if (data.kind === "revise") return "Revision requested";
    if (data.kind === "create") return "Create requested";
    return "Completion requested";
  }, [data]);

  useEffect(() => {
    if (!data?.procedure) return;
    setDraftTitle(data.procedure.title ?? "");
    setDraftSteps(
      (data.procedure.steps ?? []).map((s) => ({
        key: newKey(),
        text: (s.text ?? "").trim(),
        image_url: (s.image_url ?? null) as string | null,
      })),
    );
  }, [data?.procedure?.id, data?.procedure?.updated_at]);

  const addDraftStep = () => setDraftSteps((prev) => [...prev, { key: newKey(), text: "", image_url: null }]);
  const removeDraftStep = (key: string) => setDraftSteps((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));

  const onSaveRevision = async () => {
    if (!token || !data?.procedure?.id) return;
    if (!canEditSteps) return;
    const t = draftTitle.trim();
    if (!t) {
      Alert.alert("Procedure", "Enter a title.");
      return;
    }
    const normalized = draftSteps
      .map((s) => ({
        text: s.text.trim(),
        image_url: s.image_url,
      }))
      .filter((s) => s.text.length > 0 || Boolean((s.image_url ?? "").trim()));
    if (normalized.length === 0) {
      Alert.alert("Procedure", "Add at least one step.");
      return;
    }
    setBusySave(true);
    try {
      await patchProcedure(token, data.procedure.id, { title: t, steps: normalized });
      await load();
      Alert.alert("Saved", "Revision saved.");
    } catch (e) {
      Alert.alert("Save", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusySave(false);
    }
  };

  const onUploadStepPhoto = async (stepIndex: number) => {
    if (!token || !data?.procedure?.id) return;
    if (!canEditSteps) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos", "Allow photo library access to upload images.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.82,
        allowsMultipleSelection: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0]!;
      const uri = a.uri;
      const name = uri.split("/").pop() || `step-${stepIndex + 1}-${Date.now()}.jpg`;
      const type = a.mimeType || "image/jpeg";
      await uploadProcedureStepImage(token, data.procedure.id, stepIndex, { uri, name, type });
      await load();
    } catch (e) {
      Alert.alert("Upload", e instanceof Error ? e.message : "Failed to upload step photo");
    }
  };

  const onUploadPhoto = async () => {
    if (!token || !id) return;
    setBusyUpload(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos", "Allow photo library access to upload images.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0]!;
      const uri = a.uri;
      const name = uri.split("/").pop() || `procedure-${Date.now()}.jpg`;
      const type = a.mimeType || "image/jpeg";
      await uploadProcedureAssignmentPhoto(token, String(id), { uri, name, type });
      await load();
    } catch (e) {
      Alert.alert("Upload", e instanceof Error ? e.message : "Failed to upload photo");
    } finally {
      setBusyUpload(false);
    }
  };

  const onComplete = async () => {
    if (!token || !id) return;
    setBusyComplete(true);
    try {
      await completeProcedureAssignment(token, String(id));
      Alert.alert("Done", "Procedure marked complete.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert("Complete", e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyComplete(false);
    }
  };

  return (
    <Screen>
      {!token ? (
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: colors.muted }}>Sign in to view this procedure.</Text>
        </View>
      ) : !data && !err ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.success} />
        </View>
      ) : err ? (
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>Could not load procedure</Text>
          <Text style={{ color: colors.muted, marginTop: 8 }}>{err}</Text>
          <Pressable onPress={() => void load()} style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.success, fontWeight: "800" }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}>
          <Text style={{ color: colors.text, ...text.h1 }} numberOfLines={3}>
            {title}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 6, fontWeight: "800" }}>
            {kindLine} · {statusLabel}
          </Text>
          {data?.notes ? (
            <Text style={{ color: colors.text, marginTop: spacing.md, ...text.body }}>{data.notes}</Text>
          ) : null}

          <View
            style={{
              marginTop: spacing.lg,
              padding: spacing.lg,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>Steps</Text>
              {canEditSteps ? (
                <Pressable onPress={addDraftStep} disabled={busySave}>
                  <Text style={{ color: colors.success, fontWeight: "900" }}>+ Step</Text>
                </Pressable>
              ) : null}
            </View>

            {canEditSteps ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 1 }}>
                  TITLE
                </Text>
                <TextInput
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  placeholder="Procedure title"
                  placeholderTextColor={colors.muted}
                  editable={!busySave}
                  style={{
                    marginTop: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    borderRadius: radii.md,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.text,
                    fontWeight: "800",
                  }}
                />

                <View style={{ marginTop: spacing.md }}>
                  {draftSteps.map((s, idx) => (
                    <View key={s.key} style={{ marginBottom: spacing.md }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 12 }}>STEP {idx + 1}</Text>
                        {draftSteps.length > 1 ? (
                          <Pressable onPress={() => removeDraftStep(s.key)} disabled={busySave}>
                            <Text style={{ color: colors.muted, fontWeight: "900" }}>Remove</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {s.image_url ? (
                        <View style={{ marginTop: 10 }}>
                          <View
                            style={{
                              width: "100%",
                              height: 160,
                              borderRadius: radii.md,
                              overflow: "hidden",
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.surface,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {data?.procedure?.id && stepImageUris[`${data.procedure.id}:${idx}`] ? (
                              <Image
                                source={{ uri: stepImageUris[`${data.procedure.id}:${idx}`] }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Loading photo…</Text>
                            )}
                          </View>
                        </View>
                      ) : null}
                      <TextInput
                        value={s.text}
                        onChangeText={(v) =>
                          setDraftSteps((prev) => prev.map((x) => (x.key === s.key ? { ...x, text: v } : x)))
                        }
                        placeholder="Describe the step…"
                        placeholderTextColor={colors.muted}
                        multiline
                        editable={!busySave}
                        style={{
                          marginTop: 8,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                          borderRadius: radii.md,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          color: colors.text,
                          fontWeight: "700",
                          minHeight: 44,
                        }}
                      />
                      <View style={{ flexDirection: "row", marginTop: 10 }}>
                        <Pressable
                          disabled={busySave}
                          onPress={() => void onUploadStepPhoto(idx)}
                          style={{
                            flex: 1,
                            alignItems: "center",
                            paddingVertical: 10,
                            borderRadius: radii.md,
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                            opacity: busySave ? 0.7 : 1,
                          }}
                        >
                          <Text style={{ color: colors.text, fontWeight: "900" }}>
                            {s.image_url ? "Replace step photo" : "Add step photo"}
                          </Text>
                        </Pressable>
                      </View>
                      <Text style={{ color: colors.muted, marginTop: 6, fontSize: 11, fontWeight: "700" }}>
                        Step photos upload immediately. Tap “Save revision” to finalize step text/title changes.
                      </Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={() => void onSaveRevision()}
                  disabled={busySave}
                  style={{
                    marginTop: spacing.sm,
                    alignItems: "center",
                    paddingVertical: 12,
                    borderRadius: radii.lg,
                    backgroundColor: "#4C6085",
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: busySave ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontWeight: "900" }}>{busySave ? "Saving…" : "Save revision"}</Text>
                </Pressable>
              </View>
            ) : steps.length ? (
              <View style={{ marginTop: spacing.md }}>
                {isRunnerMode ? (
                  <View>
                    <View
                      style={{
                        borderRadius: radii.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        padding: spacing.lg,
                      }}
                    >
                      <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 12, letterSpacing: 1 }}>
                        STEP {runnerIndex + 1} OF {steps.length}
                      </Text>
                      <Text style={{ color: colors.text, marginTop: 10, fontSize: 18, fontWeight: "900" }}>
                        {steps[runnerIndex]?.text?.trim() || "—"}
                      </Text>

                      {steps[runnerIndex]?.image_url ? (
                        <View style={{ marginTop: spacing.md }}>
                          <View
                            style={{
                              width: "100%",
                              height: 200,
                              borderRadius: radii.md,
                              overflow: "hidden",
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.surface,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {data?.procedure?.id && stepImageUris[`${data.procedure.id}:${runnerIndex}`] ? (
                              <Image
                                source={{ uri: stepImageUris[`${data.procedure.id}:${runnerIndex}`] }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Loading photo…</Text>
                            )}
                          </View>
                        </View>
                      ) : null}

                      <Pressable
                        onPress={() =>
                          setRunnerDone((prev) => prev.map((v, i) => (i === runnerIndex ? !v : v)))
                        }
                        style={({ pressed }) => ({
                          marginTop: spacing.md,
                          borderRadius: radii.lg,
                          paddingVertical: 12,
                          alignItems: "center",
                          backgroundColor: runnerDone[runnerIndex] ? "rgba(54,241,205,0.16)" : colors.surface,
                          borderWidth: 1,
                          borderColor: runnerDone[runnerIndex] ? "rgba(54,241,205,0.4)" : colors.border,
                          opacity: pressed ? 0.92 : 1,
                        })}
                      >
                        <Text style={{ color: runnerDone[runnerIndex] ? colors.success : colors.text, fontWeight: "900" }}>
                          {runnerDone[runnerIndex] ? "✓ Done" : "Mark step done"}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.md }}>
                      <Pressable
                        disabled={runnerIndex === 0}
                        onPress={() => setRunnerIndex((i) => Math.max(0, i - 1))}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          paddingVertical: 12,
                          borderRadius: radii.lg,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                          opacity: runnerIndex === 0 ? 0.5 : 1,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "900" }}>Prev</Text>
                      </Pressable>
                      <Pressable
                        disabled={runnerIndex >= steps.length - 1}
                        onPress={() => setRunnerIndex((i) => Math.min(steps.length - 1, i + 1))}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          paddingVertical: 12,
                          borderRadius: radii.lg,
                          backgroundColor: colors.success,
                          opacity: runnerIndex >= steps.length - 1 ? 0.6 : 1,
                        }}
                      >
                        <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>Next</Text>
                      </Pressable>
                    </View>

                    <Text style={{ color: colors.muted, marginTop: 10, fontSize: 12, fontWeight: "700" }}>
                      Progress: {runnerDone.filter(Boolean).length}/{steps.length} done
                    </Text>
                  </View>
                ) : (
                  steps.map((s, idx) => (
                    <View key={`${idx}-${s.text}`} style={{ marginBottom: spacing.md }}>
                      <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 12 }}>STEP {idx + 1}</Text>
                      <Text style={{ color: colors.text, marginTop: 6, fontSize: 14, fontWeight: "700" }}>{s.text || "—"}</Text>
                      {s.image_url ? (
                        <View style={{ marginTop: 10 }}>
                          <View
                            style={{
                              width: "100%",
                              height: 160,
                              borderRadius: radii.md,
                              overflow: "hidden",
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.surface,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {data?.procedure?.id && stepImageUris[`${data.procedure.id}:${idx}`] ? (
                              <Image
                                source={{ uri: stepImageUris[`${data.procedure.id}:${idx}`] }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Loading photo…</Text>
                            )}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            ) : (
              <Text style={{ color: colors.muted, marginTop: spacing.md }}>No steps yet.</Text>
            )}
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>Photos</Text>
            <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12, fontWeight: "700" }}>
              Upload evidence photos (before/after, readings, etc.).
            </Text>

            <View style={{ marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap" }}>
              {(data?.photos ?? []).map((ph) => {
                const uri = photoUris[ph.id];
                return (
                  <View
                    key={ph.id}
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      marginRight: spacing.sm,
                      marginBottom: spacing.sm,
                      overflow: "hidden",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>Loading…</Text>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", marginTop: spacing.md }}>
              <Pressable
                disabled={busyUpload || data?.status === "completed"}
                onPress={() => void onUploadPhoto()}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 12,
                  borderRadius: radii.lg,
                  backgroundColor: data?.status === "completed" ? colors.surface : colors.success,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: busyUpload ? 0.7 : 1,
                }}
              >
                <Text style={{ color: data?.status === "completed" ? colors.muted : "#0A0A0A", fontWeight: "900" }}>
                  {busyUpload ? "Uploading…" : "Upload photo"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Pressable
              disabled={!canComplete || busyComplete || (isRunnerMode && steps.length > 0 && !allStepsDone)}
              onPress={() => void onComplete()}
              style={{
                alignItems: "center",
                paddingVertical: 14,
                borderRadius: radii.lg,
                backgroundColor:
                  canComplete && !(isRunnerMode && steps.length > 0 && !allStepsDone) ? "#4C6085" : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: busyComplete ? 0.7 : 1,
              }}
            >
              <Text style={{ color: canComplete ? "#ffffff" : colors.muted, fontWeight: "900" }}>
                {data?.status === "completed"
                  ? "Completed"
                  : busyComplete
                    ? "Completing…"
                    : isRunnerMode && steps.length > 0 && !allStepsDone
                      ? "Complete all steps to finish"
                      : "Complete procedure"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

