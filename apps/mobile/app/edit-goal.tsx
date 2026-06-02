import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {
  computeMacroTargets, dailyTargetFromTdee, kg, latestTrendWeight,
} from "@dynamic-energy/engine";
import { Button, Card, Screen, Text, colors, fonts, fontSize, gap, hairline, radius } from "@/design";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@/context/auth";
import { repos } from "@/lib/supabase";
import { useEngine } from "@/store/engineStore";

/**
 * Mid-program goal change. Keeps profile fields fixed (those are
 * physical attributes, not preferences) and only mutates the active
 * goal row via `goalRepo.setActive` — which demotes the previous goal
 * to status='completed' and inserts a fresh one. The store re-hydrates
 * so TDEE → target recomputes immediately.
 */
export default function EditGoal() {
  const router = useRouter();
  const { userId } = useAuth();
  const currentGoal = useEngine((s) => s.goalKgPerWeek);
  const tdee = useEngine((s) => s.tdee);
  const weights = useEngine((s) => s.weights);
  const macroTargets = useEngine((s) => s.macroTargets);
  const hydrate = useEngine((s) => s.hydrate);

  const initialType: "cut" | "maintain" | "gain" =
    currentGoal === 0 ? "maintain" : currentGoal < 0 ? "cut" : "gain";

  const [goalType, setGoalType] = useState<"cut" | "maintain" | "gain">(initialType);
  const [rate, setRate] = useState(Math.abs(currentGoal).toString() || "0.5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Macro target controls. We surface protein in g/kg and fat % — the
  // two preferences most users actually have an opinion about — and
  // derive absolute grams via the engine helper. If macro targets are
  // already set, back-derive sensible defaults; otherwise start at 2.0/25 %.
  const trend = latestTrendWeight(weights);
  const initialProteinPerKg = trend && macroTargets.proteinG
    ? Number((macroTargets.proteinG / trend).toFixed(2))
    : 2.0;
  const [proteinPerKg, setProteinPerKg] = useState(initialProteinPerKg.toString());
  const [fatPct, setFatPct] = useState("25");
  const [macroEnabled, setMacroEnabled] = useState(macroTargets.proteinG != null);

  const dailyTargetPreview = useMemo(() => {
    if (!tdee) return null;
    const r = goalType === "maintain" ? 0
            : goalType === "cut"      ? -Math.abs(Number(rate) || 0)
            : Math.abs(Number(rate) || 0);
    return dailyTargetFromTdee(tdee, { kgPerWeek: r });
  }, [tdee, goalType, rate]);

  const macroPreview = useMemo(() => {
    if (!macroEnabled || !dailyTargetPreview || !trend) return null;
    try {
      return computeMacroTargets(dailyTargetPreview, kg(trend), {
        proteinPerKg: Number(proteinPerKg) || 2.0,
        fatPct: (Number(fatPct) || 25) / 100,
      });
    } catch {
      return null;
    }
  }, [macroEnabled, dailyTargetPreview, trend, proteinPerKg, fatPct]);

  const todayIso = (): string => new Date().toISOString().slice(0, 10);

  const onCommit = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const kgPerWeek =
        goalType === "maintain" ? 0
        : goalType === "cut" ? -Math.abs(Number(rate))
        : Math.abs(Number(rate));
      if (!Number.isFinite(kgPerWeek)) {
        setError("Rate must be a number.");
        setBusy(false);
        return;
      }
      await repos.goal.setActive({
        userId,
        goalType,
        rateKgPerWeek: kgPerWeek,
        startDate: todayIso() as never,
        proteinGTarget: macroEnabled && macroPreview ? macroPreview.proteinG : null,
        carbsGTarget:   macroEnabled && macroPreview ? macroPreview.carbsG   : null,
        fatGTarget:     macroEnabled && macroPreview ? macroPreview.fatG     : null,
      });
      await hydrate(userId);
      haptic.success();
      router.back();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Screen eyebrow="Mission · Re-trajectory" title="REVISE GOAL">
      <Text variant="body" color={colors.muted}>
        Adjust the weekly target without touching the rest of your profile.
        The current week's posterior continues from where it is; the new
        rate just changes how the engine maps TDEE → daily calorie target
        from now forward.
      </Text>

      <Card>
        <View style={{ gap: gap.lg }}>
          <View style={{ gap: gap.sm }}>
            <Text variant="meta">Trajectory</Text>
            <View style={{
              flexDirection: "row", borderWidth: hairline.width, borderColor: colors.border,
              borderRadius: radius.sharp,
            }}>
              {(["cut", "maintain", "gain"] as const).map((t, i) => {
                const active = t === goalType;
                const label = t === "cut" ? "Cut" : t === "maintain" ? "Hold" : "Gain";
                return (
                  <Pressable
                    key={t}
                    onPress={() => { haptic.light(); setGoalType(t); }}
                    style={{
                      flex: 1, paddingVertical: gap.md,
                      backgroundColor: active ? colors.accentSoft : "transparent",
                      borderLeftWidth: i === 0 ? 0 : hairline.width, borderLeftColor: hairline.color,
                      alignItems: "center",
                    }}
                  >
                    <Text variant="meta" color={active ? colors.accent : colors.muted}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {goalType !== "maintain" && (
            <View style={{ gap: gap.sm }}>
              <Text variant="meta">Weekly Flux · KG/WK</Text>
              <TextInput
                value={rate}
                onChangeText={(s) => setRate(s.replace(/[^\d.]/g, ""))}
                keyboardType="decimal-pad"
                style={{
                  fontFamily: fonts.mono, fontSize: fontSize.bignum, fontWeight: "800",
                  color: colors.fg, borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
                  paddingVertical: gap.xs,
                }}
              />
            </View>
          )}
        </View>
      </Card>

      <Card>
        <View style={{ gap: gap.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text variant="meta">Macro Targets</Text>
            <Pressable onPress={() => { haptic.light(); setMacroEnabled((v) => !v); }}>
              <Text variant="meta" color={macroEnabled ? colors.accent : colors.muted}>
                {macroEnabled ? "ENABLED" : "DISABLED"}
              </Text>
            </Pressable>
          </View>
          {macroEnabled && (
            <>
              <View style={{ flexDirection: "row", gap: gap.md }}>
                <View style={{ flex: 1, gap: gap.xs }}>
                  <Text variant="meta">Protein · g / kg</Text>
                  <TextInput
                    value={proteinPerKg}
                    onChangeText={(s) => setProteinPerKg(s.replace(/[^\d.]/g, ""))}
                    keyboardType="decimal-pad"
                    style={{
                      fontFamily: fonts.mono, fontSize: 28, fontWeight: "800",
                      color: colors.fg, borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
                      paddingVertical: gap.xs,
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: gap.xs }}>
                  <Text variant="meta">Fat · %</Text>
                  <TextInput
                    value={fatPct}
                    onChangeText={(s) => setFatPct(s.replace(/[^\d.]/g, ""))}
                    keyboardType="decimal-pad"
                    style={{
                      fontFamily: fonts.mono, fontSize: 28, fontWeight: "800",
                      color: colors.fg, borderBottomWidth: hairline.width, borderBottomColor: hairline.color,
                      paddingVertical: gap.xs,
                    }}
                  />
                </View>
              </View>
              {macroPreview && (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Stat label="P" value={`${macroPreview.proteinG} g`} accent />
                  <Stat label="C" value={`${macroPreview.carbsG} g`} />
                  <Stat label="F" value={`${macroPreview.fatG} g`} />
                  <Stat label="kcal" value={`${dailyTargetPreview != null ? Math.round(dailyTargetPreview) : "—"}`} />
                </View>
              )}
              {!trend && (
                <Text variant="meta" color={colors.muted}>
                  Log at least one weight to enable macro derivation.
                </Text>
              )}
            </>
          )}
        </View>
      </Card>

      {error && <Text variant="meta" color={colors.accent}>{error}</Text>}

      <Button onPress={onCommit} disabled={busy}>
        {busy ? "Committing…" : "Commit New Goal"}
      </Button>
      <Button onPress={() => router.back()} variant="secondary">Cancel</Button>
    </Screen>
  );
}

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <View style={{ gap: 2 }}>
    <Text variant="meta">{label}</Text>
    <Text variant="num" color={accent ? colors.accent : colors.fg} style={{ fontSize: 18, fontWeight: "700" as const }}>
      {value}
    </Text>
  </View>
);
