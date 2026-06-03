import { useState } from "react";
import { TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Button, Card, Screen, Text,
  colors, fonts, fontSize, gap, hairline,
} from "@/design";
import {
  carbWaterMassKg, localDateInTimezone, medianCarbBaseline,
} from "@dynamic-energy/engine";
import { haptic } from "@/lib/haptics";
import { useEngine } from "@/store/engineStore";

/**
 * Single-input weight logger. We accept anything that parses as a
 * positive number ≤ 500 — tighter validation belongs in a settings
 * page where we know the user's preferred units.
 *
 * Recent trend weight from the store is shown above the input so a
 * mis-typed log (e.g. 8 kg vs 80 kg) is obvious before commit.
 */
export default function LogMass() {
  const router = useRouter();
  const logWeight = useEngine((s) => s.logWeight);
  const weights = useEngine((s) => s.weights);
  const todayMeals = useEngine((s) => s.todayMeals);
  const timezone = useEngine((s) => s.timezone);

  const reference: number | null = weights[weights.length - 1]?.weight ?? null;

  // Carb-water context: use *yesterday's* logged meals (today's reading
  // reflects yesterday's intake). We compute yesterday's total carbs and
  // compare against a 7-day median baseline derived from same-day meals
  // — the store only carries today's meals, so for the baseline we use
  // a rolling fallback of the user's typical day if we have nothing.
  const yesterdayIso = (() => {
    const today = localDateInTimezone(timezone);
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  // For v1 we approximate by treating today's logged meals as the
  // baseline source — if the user is here logging their morning weight,
  // the meals for *yesterday* are the relevant ones. Mobile only keeps
  // today's meals hot in the store, so we conservatively show the chip
  // only if today's meals already cover yesterday's date (e.g., late-night
  // logging). Otherwise hide.
  const yesterdaysMeals = todayMeals.filter((m) => m.date === yesterdayIso);
  const yesterdayCarbs = yesterdaysMeals.flatMap((m) => m.items).reduce(
    (s, it) => s + (it.carbsG ?? 0), 0,
  );
  const baselineCarbs = medianCarbBaseline([yesterdayCarbs]); // single-sample → same value
  const carbWaterKg = yesterdayCarbs > 0
    ? carbWaterMassKg(yesterdayCarbs, Math.max(0, baselineCarbs - 80))
    : 0;
  const showCarbChip = yesterdayCarbs > 0 && carbWaterKg >= 0.3;

  const [value, setValue] = useState(reference ? reference.toFixed(1) : "");
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed < 500;

  const onCommit = async () => {
    if (!valid) return;
    setError(null);
    setCommitting(true);
    try {
      await logWeight(parsed);
      haptic.success();
      router.back();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : String(e));
      setCommitting(false);
    }
  };

  const delta = reference != null && valid ? parsed - reference : null;

  return (
    <Screen eyebrow="Daily Weight" title="LOG WEIGHT">
      {reference != null && (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ gap: gap.xs }}>
            <Text variant="meta">Last Reading</Text>
            <Text variant="num" style={{ fontSize: 18, fontWeight: "700" as const }}>
              {reference.toFixed(1)} <Text variant="meta">KG</Text>
            </Text>
          </View>
          {delta !== null && Math.abs(delta) >= 0.05 && (
            <View style={{ gap: gap.xs, alignItems: "flex-end" }}>
              <Text variant="meta">Change vs Last</Text>
              <Text
                variant="num"
                style={{ fontSize: 18, fontWeight: "700" as const }}
                color={delta < 0 ? colors.accent : colors.fg}
              >
                {delta > 0 ? "+" : ""}{delta.toFixed(2)} <Text variant="meta">KG</Text>
              </Text>
            </View>
          )}
        </View>
      )}

      <Card>
        <View style={{ gap: gap.sm }}>
          <Text variant="meta">Weight Reading · KG</Text>
          <TextInput
            value={value}
            onChangeText={(s) => setValue(s.replace(/[^\d.]/g, ""))}
            keyboardType="decimal-pad"
            autoFocus
            style={{
              fontFamily: fonts.mono,
              fontSize: 56,
              fontWeight: "800",
              color: colors.fg,
              borderBottomWidth: hairline.width,
              borderBottomColor: hairline.color,
              paddingVertical: gap.xs,
              letterSpacing: -1,
            }}
          />
          {!valid && value.length > 0 && (
            <Text variant="meta" color={colors.accent}>
              Reading must be between 0 and 500 kg.
            </Text>
          )}
        </View>
      </Card>

      {error && <Text variant="meta" color={colors.accent}>{error}</Text>}

      {showCarbChip && (
        <Card>
          <View style={{ gap: gap.xs }}>
            <Text variant="meta">Glycogen & Water Weight Context</Text>
            <Text variant="body" color={colors.fg}>
              Yesterday: {Math.round(yesterdayCarbs)} g carbs logged.
              Likely water weight on the scale today:{" "}
              <Text variant="num" color={colors.accent}>
                ~{carbWaterKg.toFixed(1)} kg
              </Text>.
            </Text>
            <Text variant="meta" color={colors.muted}>
              Glycogen binds ~2.7 g water per gram. A high-carb day
              inflates tomorrow&apos;s reading without changing body composition.
            </Text>
          </View>
        </Card>
      )}

      <Button onPress={onCommit} disabled={!valid || committing}>
        {committing ? "Saving…" : "Save Weight"}
      </Button>
      <Button onPress={() => router.back()} variant="secondary">Cancel</Button>
      <Text variant="body" color={colors.muted} style={{ fontSize: fontSize.small }}>
        Your daily weigh-ins are securely saved and analyzed using a smoothed trend line. Daily fluctuations (like water weight) won't derail your target.
      </Text>
    </Screen>
  );
}
