import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { EmptyState } from "@/components/EmptyState";
import { PriorityPill } from "@/components/PriorityPill";
import {
  usePatchAttachmentsMutation,
  usePostCommentMutation,
  usePostStatusMutation,
  useWorkRequestDetailQuery,
} from "@/hooks/useWorkRequests";
import { colors, layout, radius, shadows, space, typography } from "@/utils/designTokens";

type RouteParams = { issueId: string };

export function IssueDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { issueId } = route.params as RouteParams;
  const { data, isLoading, isError } = useWorkRequestDetailQuery(issueId);
  const statusMut = usePostStatusMutation();
  const commentMut = usePostCommentMutation();
  const attachMut = usePatchAttachmentsMutation();
  const [note, setNote] = useState("");

  const timeline = useMemo(() => {
    if (!data) return [];
    const parts: { id: string; kind: string; label: string; at: string }[] = [];
    for (const c of data.comments) {
      parts.push({
        id: c.id,
        kind: "comment",
        label: `${c.user_name ?? "User"}: ${c.message}`,
        at: c.created_at,
      });
    }
    for (const a of data.activity) {
      parts.push({
        id: a.id,
        kind: "activity",
        label: `${a.action}${a.performer_name ? ` · ${a.performer_name}` : ""}`,
        at: a.created_at,
      });
    }
    return parts.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [data]);

  async function onPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo library access to attach images.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (res.canceled || !data) return;
    const asset = res.assets[0];
    if (!asset?.base64) return;
    const mime = asset.mimeType ?? "image/jpeg";
    const dataUrl = `data:${mime};base64,${asset.base64}`;
    const next = [
      ...(Array.isArray(data.attachments) ? data.attachments : []),
      {
        type: "mobile_photo",
        data_url: dataUrl,
        captured_at: new Date().toISOString(),
      },
    ];
    try {
      await attachMut.mutateAsync({ id: issueId, attachments: next });
    } catch {
      Alert.alert("Upload failed", "Could not attach photo. Try again or add a note instead.");
    }
  }

  function onAddNote() {
    const t = note.trim();
    if (!t) return;
    commentMut.mutate(
      { id: issueId, message: t },
      {
        onSuccess: () => setNote(""),
        onError: () => Alert.alert("Could not save note"),
      },
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: space.xl }} color={colors.accent} />
      </SafeAreaView>
    );
  }
  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState title="Issue not found" subtitle="It may have been closed or removed." />
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backTxt}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backIcon}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          Issue
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headCard}>
          <Text style={styles.title}>{data.title}</Text>
          <View style={styles.row}>
            <PriorityPill priority={data.priority} />
            <Text style={styles.statusTxt}>{data.display_status}</Text>
          </View>
          <Text style={styles.meta}>
            {data.location_name ?? "Location TBD"}
            {data.equipment_name ? ` · ${data.equipment_name}` : ""}
          </Text>
        </View>

        {data.description ? (
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Description</Text>
            <Text style={styles.body}>{data.description}</Text>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.blockLabel}>Sensor / asset</Text>
          <Text style={styles.body}>
            {data.equipment_name
              ? `Linked equipment: ${data.equipment_name}. Last sync OK (demo).`
              : "No sensor stream linked. Supervisors can attach equipment in Pulse web."}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            disabled={statusMut.isPending}
            onPress={() =>
              statusMut.mutate(
                { id: issueId, status: "in_progress" },
                { onError: () => Alert.alert("Could not update status") },
              )
            }
          >
            <Text style={styles.btnSecondaryTxt}>Mark in progress</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            disabled={statusMut.isPending}
            onPress={() =>
              statusMut.mutate(
                { id: issueId, status: "completed" },
                { onError: () => Alert.alert("Could not resolve") },
              )
            }
          >
            <Text style={styles.btnPrimaryTxt}>Resolve</Text>
          </Pressable>
        </View>

        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => void onPhoto()}>
          <Text style={styles.btnGhostTxt}>Upload photo</Text>
        </Pressable>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>Add note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Type a short update…"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            multiline
          />
          <Pressable style={[styles.btn, styles.btnPrimary, { marginTop: space.sm }]} onPress={onAddNote}>
            <Text style={styles.btnPrimaryTxt}>Save note</Text>
          </Pressable>
        </View>

        <Text style={styles.blockLabel}>Timeline</Text>
        {timeline.length === 0 ? (
          <Text style={styles.muted}>No history yet.</Text>
        ) : (
          timeline.map((row) => (
            <View key={row.id} style={styles.tlRow}>
              <View style={[styles.dot, row.kind === "comment" ? styles.dotC : styles.dotA]} />
              <View style={styles.tlBody}>
                <Text style={styles.tlText}>{row.label}</Text>
                <Text style={styles.tlTime}>{new Date(row.at).toLocaleString()}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: layout.screenPaddingH, paddingBottom: space.xxl },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenPaddingH - 8,
    paddingBottom: space.sm,
  },
  backIcon: { padding: 4 },
  topTitle: { ...typography.section, flex: 1, textAlign: "center" },
  headCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
    marginBottom: space.md,
  },
  title: { ...typography.body, fontWeight: "800", fontSize: 18, color: colors.textPrimary },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
  statusTxt: { ...typography.caption, color: colors.textSecondary },
  meta: { marginTop: space.xs, ...typography.bodySm, color: colors.textSecondary },
  block: { marginBottom: space.md },
  blockLabel: { ...typography.caption, color: colors.textTertiary, marginBottom: space.xs },
  body: { ...typography.bodySm, color: colors.textPrimary, lineHeight: 22 },
  actions: { flexDirection: "row", gap: space.sm, marginBottom: space.sm },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryTxt: { color: "#fff", fontWeight: "800" },
  btnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnSecondaryTxt: { color: colors.textPrimary, fontWeight: "700" },
  btnGhost: {
    flex: undefined,
    alignSelf: "stretch",
    backgroundColor: colors.surfaceMuted,
    marginBottom: space.md,
  },
  btnGhostTxt: { fontWeight: "700", color: colors.textPrimary },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: space.md,
    minHeight: 80,
    textAlignVertical: "top",
    color: colors.textPrimary,
  },
  muted: { ...typography.bodySm, color: colors.textTertiary },
  tlRow: { flexDirection: "row", marginTop: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, marginRight: space.sm },
  dotC: { backgroundColor: colors.accent },
  dotA: { backgroundColor: colors.textTertiary },
  tlBody: { flex: 1 },
  tlText: { ...typography.bodySm, color: colors.textPrimary },
  tlTime: { ...typography.micro, color: colors.textTertiary, marginTop: 2 },
  backBtn: { margin: space.lg, alignSelf: "center" },
  backTxt: { color: colors.accent, fontWeight: "700" },
});
