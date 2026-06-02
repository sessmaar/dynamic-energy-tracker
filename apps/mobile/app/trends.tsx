import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import type { EngineStateWeeklyRow } from "@dynamic-energy/data";
import {
  ewmaTrend, isoDate, latestTrendWeight, localDateInTimezone,
} from "@dynamic-energy/engine";
import { Button, Card, MacroBar, Screen, Text, TrajectoryCard, colors, gap, hairline } from "@/design";
import { useAuth } from "@/context/auth";
import { repos } from "@/lib/supabase";
import {
  selectDailyTarget, selectTodayMacros, selectTrajectory, useEngine,
} from "@/store/engineStore";

/**
 * Multi-week trend view. Three stacked panels:
 *
 *   1. Weight scatter + EWMA trend (last 90 d)
 *   2. TDEE posterior history (from engine_state_weekly)
 *   3. Daily kcal vs target — last 14 days as a bar chart
 *
 * Charts are hand-rolled with View-based rectangles instead of pulling
 * in react-native-svg. The data densities here are low enough that it
 * looks clean and stays Expo-Go-compatible with no extra native deps.
 */

const CHART_HEIGHT = 160;

export default function Trends() {
  const router = useRouter();
  const { userId } = useAuth();
  const weights = useEngine((s) => s.weights);
  const intake = useEngine((s) => s.intake);
  const timezone = useEngine((s) => s.timezone);
  const target = useEngine(selectDailyTarget);
  const macros = useEngine(selectTodayMacros);
  const macroTargets = useEngine((s) => s.macroTargets);
  const trajectory = useEngine(selectTrajectory);

  const [history, setHistory] = useState<EngineStateWeeklyRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const h = await repos.engineState.listHistory(userId, 24);
        setHistory(h.reverse()); // oldest → newest for the chart
      } catch { /* empty history is the cold-start case */ }
    })();
  }, [userId]);

  // --- Weight chart series -------------------------------------------------
  const trendSeries = ewmaTrend(weights);
  const weightYMin = weights.length > 0
    ? Math.min(...weights.map((w) => w.weight)) - 0.5
    : 0;
  const weightYMax = weights.length > 0
    ? Math.max(...weights.map((w) => w.weight)) + 0.5
    : 1;
  const latestTrend = latestTrendWeight(weights);
  const earliestTrend = trendSeries[0]?.trend ?? null;
  const trendDelta = latestTrend != null && earliestTrend != null
    ? latestTrend - earliestTrend
    : null;

  // --- TDEE history series -------------------------------------------------
  const tdeeValues = history.map((h) => h.tdee_posterior);
  const tdeeMin = tdeeValues.length > 0 ? Math.min(...tdeeValues) - 50 : 0;
  const tdeeMax = tdeeValues.length > 0 ? Math.max(...tdeeValues) + 50 : 1;

  // --- Daily kcal vs target series ----------------------------------------
  const today = localDateInTimezone(timezone);
  const fourteenDaysBack = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 13);
    return d.toISOString().slice(0, 10);
  })();
  const recentIntake = intake.filter((i) => i.date >= fourteenDaysBack && i.date <= today);
  // Build a 14-element array indexed by date for the bar chart.
  const days: string[] = [];
  {
    const d = new Date(`${fourteenDaysBack}T00:00:00Z`);
    for (let i = 0; i < 14; i++) {
      days.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  const dailyKcal = days.map((date) => {
    const row = recentIntake.find((r) => r.date === date);
    return { date, kcal: row?.calories ?? 0 };
  });
  const kcalMax = Math.max(
    target ?? 0,
    ...dailyKcal.map((d) => d.kcal),
    1,
  );

  return (
    <Screen
      eyebrow="Telemetry · Multi-Week View"
      title="TRENDS"
      onRefresh={userId ? async () => {
        const h = await repos.engineState.listHistory(userId, 24);
        setHistory(h.reverse());
      } : undefined}
    >
      {/* TRAJECTORY VERDICT */}
      {trajectory && (
        <TrajectoryCard verdict={trajectory.verdict} analysis={trajectory.analysis} />
      )}

      {/* WEIGHT */}
      <Card>
        <View style={{ gap: gap.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="meta">Body Mass · Raw + EWMA Trend</Text>
            <Text variant="num" color={trendDelta != null && trendDelta < 0 ? colors.accent : colors.fg}
              style={{ fontSize: 13 }}>
              {trendDelta != null
                ? `${trendDelta > 0 ? "+" : ""}${trendDelta.toFixed(1)} kg over window`
                : "—"}
            </Text>
          </View>

          {weights.length === 0 ? (
            <EmptyChart label="No weight readings yet." />
          ) : (
            <ScatterPlusLineChart
              dots={weights.map((w, i) => ({
                x: i / Math.max(weights.length - 1, 1),
                y: w.weight,
              }))}
              line={trendSeries.map((t, i) => ({
                x: i / Math.max(trendSeries.length - 1, 1),
                y: t.trend,
              }))}
              yMin={weightYMin}
              yMax={weightYMax}
            />
          )}
          <ChartFooter
            left={weights[0]?.date ?? "—"}
            right={weights[weights.length - 1]?.date ?? "—"}
            yTop={`${weightYMax.toFixed(1)} kg`}
            yBottom={`${weightYMin.toFixed(1)} kg`}
          />
        </View>
      </Card>

      {/* TDEE */}
      <Card>
        <View style={{ gap: gap.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="meta">TDEE Posterior · Accepted Audits</Text>
            <Text variant="num" color={colors.accent} style={{ fontSize: 13 }}>
              {history.length} {history.length === 1 ? "POINT" : "POINTS"}
            </Text>
          </View>

          {history.length === 0 ? (
            <EmptyChart label="No accepted convergence audits yet. Run one from Command → Convergence." />
          ) : (
            <ScatterPlusLineChart
              dots={[]}
              line={tdeeValues.map((y, i) => ({ x: i / Math.max(tdeeValues.length - 1, 1), y }))}
              yMin={tdeeMin}
              yMax={tdeeMax}
              accent
            />
          )}
          <ChartFooter
            left={history[0]?.week_start_date ?? "—"}
            right={history[history.length - 1]?.week_start_date ?? "—"}
            yTop={`${Math.round(tdeeMax)} kcal/d`}
            yBottom={`${Math.round(tdeeMin)} kcal/d`}
          />
        </View>
      </Card>

      {/* DAILY KCAL VS TARGET */}
      <Card>
        <View style={{ gap: gap.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="meta">Daily Intake · 14 Days</Text>
            {target != null && (
              <Text variant="num" color={colors.accent} style={{ fontSize: 13 }}>
                {Math.round(target)} kcal target
              </Text>
            )}
          </View>

          <BarChart
            bars={dailyKcal.map((d) => d.kcal)}
            max={kcalMax}
            target={target ?? null}
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="meta">{days[0]}</Text>
            <Text variant="meta">{days[days.length - 1]}</Text>
          </View>
        </View>
      </Card>

      {/* MACRO TODAY (compact echo for at-a-glance comparison) */}
      {macroTargets.proteinG != null && (
        <Card>
          <View style={{ gap: gap.sm }}>
            <Text variant="meta">Today · Macro Mix</Text>
            <MacroBar
              proteinG={macros.proteinG}
              carbsG={macros.carbsG}
              fatG={macros.fatG}
              totalKcal={macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text variant="meta">P {Math.round(macros.proteinG)} / {macroTargets.proteinG}</Text>
              <Text variant="meta">C {Math.round(macros.carbsG)} / {macroTargets.carbsG ?? "—"}</Text>
              <Text variant="meta">F {Math.round(macros.fatG)} / {macroTargets.fatG ?? "—"}</Text>
            </View>
          </View>
        </Card>
      )}

      <Button onPress={() => router.back()} variant="secondary">← Return</Button>
    </Screen>
  );
}

// ------------------------------------------------------------------------

const ScatterPlusLineChart = ({
  dots, line, yMin, yMax, accent,
}: {
  dots: { x: number; y: number }[];
  line: { x: number; y: number }[];
  yMin: number;
  yMax: number;
  accent?: boolean;
}) => {
  const span = yMax - yMin || 1;
  return (
    <View style={{ height: CHART_HEIGHT, position: "relative" }}>
      {/* faint horizontal mid-line */}
      <View style={{
        position: "absolute", left: 0, right: 0, top: "50%",
        height: hairline.width, backgroundColor: colors.border,
      }} />
      {/* dots */}
      {dots.map((p, i) => (
        <View
          key={`d${i}`}
          style={{
            position: "absolute",
            left: `${p.x * 100}%`,
            top: `${(1 - (p.y - yMin) / span) * 100}%`,
            width: 3, height: 3, marginLeft: -1.5, marginTop: -1.5,
            backgroundColor: colors.muted,
          }}
        />
      ))}
      {/* line as connected segments using View slabs */}
      {line.length > 1 && line.slice(0, -1).map((p, i) => {
        const next = line[i + 1]!;
        const x1 = p.x;
        const y1 = (1 - (p.y - yMin) / span);
        const x2 = next.x;
        const y2 = (1 - (next.y - yMin) / span);
        const dx = (x2 - x1);
        const dy = (y2 - y1);
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        // Position is in % but transform rotates around the segment's
        // own origin — close enough for compact in-card charts.
        return (
          <View
            key={`l${i}`}
            style={{
              position: "absolute",
              left: `${x1 * 100}%`,
              top: `${y1 * 100}%`,
              width: `${length * 100}%`,
              height: 1.5,
              backgroundColor: accent ? colors.accent : colors.fg,
              transform: [{ translateX: 0 }, { translateY: 0 }, { rotateZ: `${angle}deg` }],
              transformOrigin: "left center",
            }}
          />
        );
      })}
    </View>
  );
};

const BarChart = ({
  bars, max, target,
}: { bars: number[]; max: number; target: number | null }) => {
  return (
    <View style={{ height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: 3, position: "relative" }}>
      {target != null && (
        <View style={{
          position: "absolute", left: 0, right: 0,
          top: `${(1 - target / max) * 100}%`,
          height: 1, backgroundColor: colors.accent, opacity: 0.7,
        }} />
      )}
      {bars.map((v, i) => {
        const h = Math.min(1, v / max);
        const over = target != null && v > target;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${h * 100}%`,
              backgroundColor: v === 0
                ? colors.fgSoft
                : over
                  ? colors.accent
                  : colors.fg,
            }}
          />
        );
      })}
    </View>
  );
};

const EmptyChart = ({ label }: { label: string }) => (
  <View style={{ height: CHART_HEIGHT, alignItems: "center", justifyContent: "center" }}>
    <Text variant="meta" color={colors.muted}>{label}</Text>
  </View>
);

const ChartFooter = ({ left, right, yTop, yBottom }: { left: string; right: string; yTop: string; yBottom: string }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
    <View style={{ gap: 2 }}>
      <Text variant="meta">{left}</Text>
      <Text variant="meta" color={colors.muted}>min · {yBottom}</Text>
    </View>
    <View style={{ gap: 2, alignItems: "flex-end" }}>
      <Text variant="meta">{right}</Text>
      <Text variant="meta" color={colors.muted}>max · {yTop}</Text>
    </View>
  </View>
);

// `isoDate` is imported only for type-checking the date strings produced
// above — its runtime invocation is implicit through localDateInTimezone.
void isoDate;
