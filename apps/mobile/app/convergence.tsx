import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import type { EngineStateWeeklyRow } from "@dynamic-energy/data";
import { Button, Card, Screen, Text, colors, gap, hairline } from "@/design";
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
    <Screen eyebrow="System · Bayesian Audit" title="CONVERGENCE">
      <Text variant="body" color={colors.muted}>
        The engine re-weights its TDEE estimate against the previous 7 days. Confidence rises with
        data completeness; insufficient logs leave the prior untouched.
      </Text>

      <Card>
        <View style={{ gap: gap.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text variant="meta">Window · Open</Text>
              <Text variant="num" style={{ fontSize: 18, fontWeight: "700" as const }}>{start}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text variant="meta">Window · Close</Text>
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
                  <Text variant="meta">Δ Trend Mass</Text>
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
                  <Text variant="meta">Data Completeness</Text>
                  <Text variant="num" color={colors.accent} style={{ fontSize: 18 }}>
                    {Math.round(lastCheckin.completeness * 100)}%
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text variant="meta">Inferred TDEE</Text>
                  <Text variant="num" style={{ fontSize: 18 }}>
                    {fmt(lastCheckin.tdeeWeek)} <Text variant="meta">KCAL/D</Text>
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text variant="body" color={colors.muted}>
              No audit yet for this window. Run convergence to compute.
            </Text>
          )}
        </View>
      </Card>

      {delta !== null && (
        <Card>
          <View style={{ gap: gap.sm }}>
            <Text variant="meta">Posterior Shift</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: gap.md }}>
              <Text variant="num" color={colors.muted} style={{ fontSize: 20 }}>
                {fmt(priorSnapshot)}
              </Text>
              <Text variant="meta">→</Text>
              <Text variant="num" color={colors.accent} style={{ fontSize: 26, fontWeight: "800" as const }}>
                {fmt(tdee)}
              </Text>
              <Text variant="meta">
                ({delta > 0 ? "+" : ""}{Math.round(delta)})
              </Text>
            </View>
          </View>
        </Card>
      )}

      {error && <Text variant="meta" color={colors.accent}>{error}</Text>}

      <Button onPress={onRun}>Run Convergence</Button>
      {lastCheckin && lastCheckin.daysWithBoth >= 3 && !accepted && (
        <Button onPress={onAccept} disabled={accepting} variant="secondary">
          {accepting ? "Persisting…" : "Accept · Commit Posterior to Audit Log"}
        </Button>
      )}
      {accepted && (
        <Text variant="meta" color={colors.accent}>
          Posterior committed. Engine state persisted.
        </Text>
      )}
      {history.length > 0 && (
        <View style={{ gap: gap.sm }}>
          <Text variant="meta">Audit Log · {history.length} Accepted Posteriors</Text>
          <View style={{ borderWidth: hairline.width, borderColor: colors.border }}>
            {history.map((h, i) => (
              <View
                key={h.id}
                style={{
                  padding: gap.md, gap: 2,
                  borderTopWidth: i === 0 ? 0 : hairline.width,
                  borderTopColor: hairline.color,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text variant="meta">{h.week_start_date}</Text>
                  <Text variant="num" color={colors.accent} style={{ fontSize: 16, fontWeight: "700" as const }}>
                    {Math.round(h.tdee_posterior)} <Text variant="meta" color={colors.accent}>KCAL/D</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text variant="meta">
                    Δ {h.delta_weight_kg > 0 ? "+" : ""}{h.delta_weight_kg.toFixed(2)} kg ·
                    α {h.alpha.toFixed(2)} ·
                    {Math.round(h.data_completeness_score * 100)}% data
                  </Text>
                  <Text variant="meta">
                    from {Math.round(h.tdee_prior)} ({h.tdee_posterior > h.tdee_prior ? "+" : ""}
                    {Math.round(h.tdee_posterior - h.tdee_prior)})
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <Button onPress={() => router.back()} variant="secondary">Return to Command</Button>
    </Screen>
  );
}
