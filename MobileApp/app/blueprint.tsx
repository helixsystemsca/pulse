import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { getBlueprint, type BlueprintDetail, type BlueprintElement } from "@/lib/api/blueprints";

function safeId(raw: string | string[] | undefined): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ? String(raw[0]) : null;
  return String(raw);
}

function boundsOf(elements: BlueprintElement[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const el of elements) {
    const x = Number(el.x ?? 0);
    const y = Number(el.y ?? 0);
    const w = Number(el.width ?? 0);
    const h = Number(el.height ?? 0);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + (w > 0 ? w : 0));
    maxY = Math.max(maxY, y + (h > 0 ? h : 0));
    const pts = Array.isArray(el.path_points) ? el.path_points : null;
    if (pts && pts.length >= 2) {
      for (let i = 0; i + 1 < pts.length; i += 2) {
        const px = Number(pts[i]);
        const py = Number(pts[i + 1]);
        if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { minX: 0, minY: 0, maxX: 600, maxY: 400 };
  }
  return { minX, minY, maxX, maxY };
}

export default function BlueprintScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const token = session?.token ?? "";
  const id = safeId(useLocalSearchParams<{ id?: string }>().id);

  const [scale, setScale] = useState(1);
  const [row, setRow] = useState<BlueprintDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setBusy(true);
    setErr(null);
    try {
      const bp = await getBlueprint(token, id);
      setRow(bp);
    } catch (e) {
      setRow(null);
      setErr(e instanceof Error ? e.message : "Failed to load drawing");
    } finally {
      setBusy(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const elements = row?.elements ?? [];
  const b = useMemo(() => boundsOf(elements), [elements]);
  const canvasW = Math.max(360, Math.ceil(b.maxX - b.minX + 80));
  const canvasH = Math.max(280, Math.ceil(b.maxY - b.minY + 80));
  const originX = -b.minX + 40;
  const originY = -b.minY + 40;

  return (
    <Screen>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={{ color: colors.text, ...text.h1 }} numberOfLines={2}>
          {row?.name ?? "Drawing"}
        </Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body }}>
          Pan with scroll. Use zoom for readability.
        </Text>

        <View style={{ flexDirection: "row", marginTop: spacing.md, gap: 10 }}>
          <Pressable
            onPress={() => setScale((s) => Math.max(0.6, Number((s - 0.1).toFixed(2))))}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: radii.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>−</Text>
          </Pressable>
          <Pressable
            onPress={() => setScale((s) => Math.min(2.6, Number((s + 0.1).toFixed(2))))}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: radii.md,
              backgroundColor: colors.success,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>+</Text>
          </Pressable>
        </View>
      </View>

      {busy ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.success} />
        </View>
      ) : err ? (
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>Could not load drawing</Text>
          <Text style={{ color: colors.muted, marginTop: 8 }}>{err}</Text>
          <Pressable onPress={() => void load()} style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.success, fontWeight: "900" }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
          showsHorizontalScrollIndicator={false}
        >
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View
              style={{
                width: canvasW,
                height: canvasH,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radii.lg,
                overflow: "hidden",
              }}
            >
              <View style={{ transform: [{ scale }], alignSelf: "flex-start" }}>
                <View style={{ width: canvasW, height: canvasH }}>
                  {elements.map((el) => {
                    const w = Number(el.width ?? 0);
                    const h = Number(el.height ?? 0);
                    const x = originX + Number(el.x ?? 0);
                    const y = originY + Number(el.y ?? 0);
                    const isBox = (el.type === "zone" || el.type === "rectangle" || el.type === "device") && w > 0 && h > 0;
                    const isEllipse = el.type === "ellipse" && w > 0 && h > 0;
                    if (!isBox && !isEllipse) return null;
                    const label = (el.name ?? "").trim();
                    return (
                      <View
                        key={el.id}
                        style={{
                          position: "absolute",
                          left: x,
                          top: y,
                          width: w,
                          height: h,
                          borderRadius: isEllipse ? Math.min(w, h) / 2 : 14,
                          borderWidth: 2,
                          borderColor: el.type === "zone" ? "rgba(54,241,205,0.55)" : "rgba(255,255,255,0.16)",
                          backgroundColor: el.type === "zone" ? "rgba(54,241,205,0.08)" : "rgba(255,255,255,0.04)",
                          padding: 8,
                        }}
                      >
                        {label ? (
                          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }} numberOfLines={2}>
                            {label}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </Screen>
  );
}

