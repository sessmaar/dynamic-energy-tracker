import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import type { EngineStateWeeklyRow } from "@dynamic-energy/data";
import { BottomNav, Button, Card, Screen, Text, colors, gap, hairline, radius } from "@/design";
import { useAuth } from "@/context/auth";
import { haptic } from "@/lib/haptics";
import { repos } from "@/lib/supabase";
import { useEngine } from "@/store/engineStore";

/** Convert a Date to YYYY-MM-DD UTC string (matches engine's IsoDate). */
const toIso = (d: Date): string => d.toISOString().slice(0, 10);

/** Returns the Monday of the week containing `d`, in UTC. */
const mondayOf = (d: Date): Date => {
  const out = new Date(d);
  const day = out.getUTCDay(); // 0 = Sun
  const delta = day === 0 ? -6 : 1 - day;
  out.setUTCDate(out.getUTCDate() + delta);
  out.setUTCHours(0, 0, 0, 0);
  return out;
};

const addDays = (d: Date, n: number): Date => {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
};

const fmt = (n: number | null | undefined, suffix = "") =>
  n == null ? "—" : `${Math.round(n).toLocaleString()}${suffix}`;

export default function Convergence() {
  const router = useRouter();
  const { userId } = useAuth();
  const tdee = useEngine((s) => s.tdee);
  const lastCheckin = useEngine((s) => s.lastCheckin);
  const runWeeklyCheckin = useEngine((s) => s.runWeeklyCheckin);

  const [history, setHistory] = useState<EngineStateWeeklyRow[]>([]);
  const refreshHistory = async () => {
    if (!userId) return;
    try {
      const rows = await repos.engineState.listHistory(userId, 12);
      setHistory(rows);
    } catch { /* silently ignore — empty history is the natural cold-start */ }
  };
  useEffect(() => { void refreshHistory(); }, [userId]);

  // Default to the most recently *completed* week (previous Mon→Sun).
  const { start, end } = useMemo(() => {
    const thisMonday = mondayOf(new Date());
    const lastMonday = addDays(thisMonday, -7);
    return { start: toIso(lastMonday), end: toIso(addDays(lastMonday, 6)) };
  }, []);

  const [priorSnapshot, setPriorSnapshot] = useState<number | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRun = () => {
    setError(null);
    setAccepted(false);
    setPriorSnapshot(tdee);
    haptic.medium();
    void runWeeklyCheckin(start, end);
  };

  const onAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await runWeeklyCheckin(start, end, { accept: true });
      await refreshHistory();
      setAccepted(true);
      haptic.success();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAccepting(false);
    }
  };

  const delta = priorSnapshot !== null && tdee !== null ? tdee - priorSnapshot : null;

  return (
    <Screen
      eyebrow="Weekly Calibration"
      title="CALIBRATION"
      footer={<BottomNav activeTab="convergence" />}
    >
      <Text variant="body" color={colors.muted}>
        Every week, the system analyzes your logged food and weight data to calibrate your daily calorie budget. The more days you log, the more precise it gets.
      </Text>

      <Card>
        <View style={{ gap: gap.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text variant="meta">Start Date</Text>
              <Text variant="num" style={{ fontSize: 18, fontWeight: "700" as const }}>{start}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text variant="meta">End Date</Text>
              <Text variant="num" style={{ fontSize: 18, fontWeight: "700" as const }}>{end}</Text>
            </View>
          </View>

          <View style={{ height: hairline.width, backgroundColor: colors.border }} />

          {lastCheckin ? (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text variant="meta">Avg Intake</Text>
                  <Text variant="num" style={{ fontSize: 22, fontWeight: "700" as const }}>
                    {fmt(lastCheckin.avgIntake)} <Text variant="meta">KCAL</Text>
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text variant="meta">Weight Change</Text>
                  <Text
                    variant="num"
                    style={{ fontSize: 22, fontWeight: "700" as const }}
                    color={lastCheckin.deltaWeightKg < 0 ? colors.accent : colors.fg}
                  >
                    {lastCheckin.deltaWeightKg > 0 ? "+" : ""}
                    {lastCheckin.deltaWeightKg.toFixed(2)} <Text variant="meta">KG</Text>
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text variant="meta">Data Logged</Text>
                  <Text variant="num" color={colors.accent} style={{ fontSize: 18 }}>
                    {Math.round(lastCheckin.completeness * 100)}% of days
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text variant="meta">Inferred Burn (TDEE)</Text>
                  <Text variant="num" style={{ fontSize: 18 }}>
                    {fmt(lastCheckin.tdeeWeek)} <Text variant="meta">KCAL/D</Text>
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text variant="body" color={colors.muted}>
              No calibration run yet for this week. Run calibration to calculate.
            </Text>
          )}
        </View>
      </Card>

      {delta !== null && (
        <Card>
          <View style={{ gap: gap.sm }}>
            <Text variant="meta">Daily Burn Adjustment</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: gap.md }}>
              <Text variant="num" color={colors.muted} style={{ fontSize: 20 }}>
                {fmt(priorSnapshot)}
              </Text>
              <Text variant="meta">→</Text>
              <Text variant="num" color={colors.accent} style={{ fontSize: 26, fontWeight: "800" as const }}>
                {fmt(tdee)}
              </Text>
              <Text variant="meta">
                ({delta > 0 ? "+" : ""}{Math.round(delta)} KCAL/D)
              </Text>
            </View>
          </View>
        </Card>
      )}

      {error && <Text variant="meta" color={colors.accent}>{error}</Text>}

      <Button onPress={onRun}>Run Weekly Calibration</Button>
      {lastCheckin && lastCheckin.daysWithBoth >= 3 && !accepted && (
        <Button onPress={onAccept} disabled={accepting} variant="secondary">
          {accepting ? "Saving…" : "Accept New Calibration"}
        </Button>
      )}
      {accepted && (
        <Text variant="meta" color={colors.accent}>
          Calibration saved. Calorie budget updated.
        </Text>
      )}
      {history.length > 0 && (
        <View style={{ gap: gap.sm }}>
          <Text variant="meta">Calibration Log · {history.length} Adjustments</Text>
          <View style={{ borderWidth: hairline.width, borderColor: colors.border, borderRadius: radius.sharp, overflow: "hidden" }}>
            {history.map((h, i) => (
              <View
                key={h.id}
                style={{
                  padding: gap.md, gap: 2,
                  borderTopWidth: i === 0 ? 0 : hairline.width,
                  borderTopColor: hairline.color,
                  backgroundColor: colors.surface,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text variant="meta">{h.week_start_date}</Text>
                  <Text variant="num" color={colors.accent} style={{ fontSize: 16, fontWeight: "700" as const }}>
                    {Math.round(h.tdee_posterior)} <Text variant="meta" color={colors.accent}>KCAL/D</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                  <Text variant="meta">
                    Weight: {h.delta_weight_kg > 0 ? "+" : ""}{h.delta_weight_kg.toFixed(2)} kg · {Math.round(h.data_completeness_score * 100)}% logged
                  </Text>
                  <Text variant="meta">
                    prior: {Math.round(h.tdee_prior)} ({h.tdee_posterior >= h.tdee_prior ? "+" : ""}
                    {Math.round(h.tdee_posterior - h.tdee_prior)})
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

    </Screen>
  );
}
