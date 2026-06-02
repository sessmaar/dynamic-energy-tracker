import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ACTIVITY_CATALOG, type ActivityKey, latestTrendWeight } from "@dynamic-energy/engine";
import { Button, Card, Screen, Text, colors, fonts, fontSize, gap, hairline } from "@/design";
import { haptic } from "@/lib/haptics";
import { useEngine } from "@/store/engineStore";

/**
 * Activity logger. We surface the MET catalog as a scrollable list of
 * tiles so the user picks an intent (run_easy / lift_heavy / etc.)
 * rather than guessing a MET number — keeps the engine's internal
 * vocabulary consistent across the wire.
 */
const LABELS: Record<ActivityKey, string> = {
  sit:         "Sitting",
  stand:       "Standing",
  walk_slow:   "Walk · slow",
  walk_brisk:  "Walk · brisk",
  treadmill_3: "Treadmill · 3 mph",
  hike:        "Hike",
  run_easy:    "Run · easy",
  run_tempo:   "Run · tempo",
  run_hard:    "Run · hard",
  cycle_easy:  "Cycle · easy",
  cycle_hard:  "Cycle · hard",
  lift_light:  "Lift · light",
  lift_heavy:  "Lift · heavy",
  hiit:        "HIIT",
  swim:        "Swim",
};

export default function LogActivity() {
  const router = useRouter();
  const logActivity = useEngine((s) => s.logActivity);
  const weights = useEngine((s) => s.weights);

  const [selected, setSelected] = useState<ActivityKey | null>(null);
  const [minutes, setMinutes] = useState("30");
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trend = latestTrendWeight(weights);
  const minutesNum = Number(minutes);
  const validMinutes = Number.isFinite(minutesNum) && minutesNum > 0 && minutesNum < 600;

  const metValue = selected ? ACTIVITY_CATALOG[selected] : null;
  const estimatedKcal = metValue && trend && validMinutes
    ? Math.round(Math.max(0, (metValue - 1) * trend * (minutesNum / 60)))
    : null;

  const onCommit = async () => {
    if (!selected || !validMinutes) return;
    setCommitting(true);
    setError(null);
    try {
      await logActivity({
        activityType: selected,
        metValue: ACTIVITY_CATALOG[selected],
        minutes: minutesNum,
      });
      haptic.success();
      router.back();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : String(e));
      setCommitting(false);
    }
  };

  return (
    <Screen eyebrow="Logger · Activity" title="EXPEND">
      <Card>
        <View style={{ gap: gap.sm }}>
          <Text variant="meta">Activity Class</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: gap.sm, paddingVertical: gap.xs }}
          >
            {(Object.keys(ACTIVITY_CATALOG) as ActivityKey[]).map((key) => {
              const active = key === selected;
              return (
                <Pressable
                  key={key}
                  onPress={() => { haptic.light(); setSelected(key); }}
                  style={{
                    borderWidth: hairline.width,
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.accentSoft : "transparent",
                    paddingVertical: gap.sm,
                    paddingHorizontal: gap.md,
                  }}
                >
                  <Text variant="meta" color={active ? colors.accent : colors.fg}>
                    {LABELS[key]}
                  </Text>
                  <Text variant="num" color={colors.muted} style={{ fontSize: 11, marginTop: 2 }}>
                    {ACTIVITY_CATALOG[key].toFixed(1)} MET
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Card>

      <Card>
        <View style={{ gap: gap.sm }}>
          <Text variant="meta">Duration · Minutes</Text>
          <TextInput
            value={minutes}
            onChangeText={(s) => setMinutes(s.replace(/[^\d]/g, ""))}
            keyboardType="number-pad"
            style={{
              fontFamily: fonts.mono, fontSize: 48, fontWeight: "800", color: colors.fg,
              borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
              paddingVertical: gap.xs,
            }}
          />
          {!validMinutes && minutes.length > 0 && (
            <Text variant="meta" color={colors.accent}>1–599 minutes.</Text>
          )}
        </View>
      </Card>

      {selected && (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ gap: 2 }}>
              <Text variant="meta">Estimated Yield</Text>
              <Text variant="num" color={colors.accent} style={{ fontSize: 28, fontWeight: "800" as const }}>
                +{estimatedKcal ?? "—"} <Text variant="meta" color={colors.accent}>KCAL</Text>
              </Text>
            </View>
            <View style={{ gap: 2, alignItems: "flex-end" }}>
              <Text variant="meta">Selected</Text>
              <Text variant="body">{LABELS[selected]}</Text>
              {trend ? (
                <Text variant="meta">{trend.toFixed(1)} kg · {ACTIVITY_CATALOG[selected].toFixed(1)} MET</Text>
              ) : (
                <Text variant="meta" color={colors.accent}>Log a weight first</Text>
              )}
            </View>
          </View>
        </Card>
      )}

      {error && <Text variant="meta" color={colors.accent}>{error}</Text>}

      <Button onPress={onCommit} disabled={!selected || !validMinutes || committing}>
        {committing ? "Logging…" : "Commit Activity"}
      </Button>
      <Button onPress={() => router.back()} variant="secondary">Cancel</Button>
      <Text variant="body" color={colors.muted} style={{ fontSize: fontSize.small }}>
        Active calories are informational — your weekly TDEE remains the source of truth.
      </Text>
    </Screen>
  );
}
