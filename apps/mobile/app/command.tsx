import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import {
  KCAL_PER_G_PROTEIN, KCAL_PER_G_CARB, KCAL_PER_G_FAT,
} from "@dynamic-energy/engine";
import {
  BottomNav, Card, MacroBar, Runway, Screen, Sparkline, TelemetryCell, TelemetryGrid, Text,
  TrajectoryCard,
  colors, gap, hairline, radius,
} from "@/design";
import { useAuth } from "@/context/auth";
import {
  selectBmr, selectComposition, selectDailyTarget, selectTodayActiveCalories, selectTodayIntake,
  selectTodayMacros, selectTrajectory, selectConvergenceStatus, useEngine,
} from "@/store/engineStore";
import { useShallow } from "zustand/react/shallow";

const fmt = (n: number | null | undefined, suffix = "") =>
  n == null ? "—" : `${Math.round(n).toLocaleString()}${suffix}`;

export default function Command() {
  const router = useRouter();
  const { userId } = useAuth();
  const tdee = useEngine((s) => s.tdee);
  const target = useEngine(selectDailyTarget);
  const intakeToday = useEngine(selectTodayIntake);
  const activeToday = useEngine(selectTodayActiveCalories);
  const bmr = useEngine(selectBmr);
  const todayMeals = useEngine((s) => s.todayMeals);
  const deleteMeal = useEngine((s) => s.deleteMeal);
  const hydrate = useEngine((s) => s.hydrate);
  const macroTargets = useEngine((s) => s.macroTargets);
  const todayMacros = useEngine(useShallow(selectTodayMacros));
  const trajectory = useEngine(useShallow(selectTrajectory));
  const composition = useEngine(useShallow(selectComposition));
  const convergence = useEngine(useShallow(selectConvergenceStatus));

  const fillFraction = target ? Math.min(intakeToday / target, 1.2) : 0;
  const net = target ? intakeToday - target : 0;

  const theoreticalKcal =
    todayMacros.proteinG * KCAL_PER_G_PROTEIN +
    todayMacros.carbsG * KCAL_PER_G_CARB +
    todayMacros.fatG * KCAL_PER_G_FAT;
  const energyDrift = Math.abs(theoreticalKcal - intakeToday);
  const showDrift = intakeToday > 0 && energyDrift > 50;

  return (
    <Screen
      onRefresh={userId ? () => hydrate(userId) : undefined}
      footer={<BottomNav activeTab="command" />}
    >
      {/* Header */}
      <View style={{ gap: 2 }}>
        <Text variant="eyebrow">Navigator</Text>
        <Text variant="h2">Dashboard</Text>
      </View>

      {/* TRAJECTORY */}
      {trajectory && (
        <TrajectoryCard verdict={trajectory.verdict} analysis={trajectory.analysis} />
      )}

      {/* Energy Flux Runway */}
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: gap.lg }}>
          <Text variant="meta">Energy Flux Runway</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text variant="num" style={{ fontSize: 13, color: net <= 0 ? colors.accent : colors.fg }}>
              {net > 0 ? "+" : ""}{Math.round(net)} <Text variant="meta">NET</Text>
            </Text>
            {showDrift && (
              <Text variant="meta" color={colors.accent} style={{ fontSize: 9 }}>
                DRIFT: {Math.round(theoreticalKcal - intakeToday)} KCAL
              </Text>
            )}
          </View>
        </View>

        <Runway fillFraction={fillFraction} targetFraction={1.0} height={36} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: gap.md }}>
          <View style={{ gap: gap.xs }}>
            <Text variant="meta">Logged</Text>
            <Text variant="bignum">{fmt(intakeToday)}</Text>
          </View>
          <View style={{ gap: gap.xs, alignItems: "flex-end" }}>
            <Text variant="meta">Daily Target</Text>
            <Text variant="num" style={{ fontSize: 20, fontWeight: "700" as const }}>
              {fmt(target)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Metabolic Stats */}
      <View style={{ gap: gap.sm }}>
        <Text variant="meta">Metabolic Stats</Text>
        <TelemetryGrid>
          <TelemetryCell>
            <Text variant="meta">{composition ? "RMR · Katch–McArdle" : "Current BMR"}</Text>
            <Text variant="num" style={{ fontSize: 18, fontWeight: "700" as const }}>
              {fmt(bmr)} <Text variant="meta">KCAL/D</Text>
            </Text>
            <Sparkline values={[0.4, 0.45, 0.42, 0.4]} activeFrom={3} />
          </TelemetryCell>
          <TelemetryCell>
            <Text variant="meta">Active Yield</Text>
            <Text variant="num" color={colors.accent} style={{ fontSize: 18, fontWeight: "700" as const }}>
              +{fmt(activeToday)} <Text variant="meta" color={colors.accent}>KCAL</Text>
            </Text>
            <Sparkline values={[0.2, 0.3, 0.8, 0.6]} activeFrom={0} />
          </TelemetryCell>
          <TelemetryCell span={2}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text variant="meta">Est. Calorie Burn · TDEE</Text>
              <Text variant="num" color={colors.accent} style={{ fontSize: 14 }}>
                {fmt(tdee)} <Text variant="meta" color={colors.accent}>KCAL/D</Text>
              </Text>
            </View>
            <View style={{ height: hairline.width, backgroundColor: colors.border, marginVertical: gap.sm }} />
            <Text variant="body" color={colors.muted} style={{ fontSize: 12 }}>
              {convergence?.isConverged
                ? "Metabolic rate is calibrated. Re-evaluate at next weekly check-in."
                : convergence
                  ? `Calibrating: ${convergence.daysRemaining} more days of logs needed for a precise update.`
                  : "Awaiting baseline. Complete initial setup to get started."}
            </Text>
          </TelemetryCell>
          {composition && (
            <TelemetryCell span={2}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ gap: gap.xs }}>
                  <Text variant="meta">Body Fat</Text>
                  <Text variant="num" color={colors.accent} style={{ fontSize: 18, fontWeight: "700" as const }}>
                    {(composition.bodyFatPct * 100).toFixed(1)}<Text variant="meta" color={colors.accent}>%</Text>
                  </Text>
                </View>
                <View style={{ gap: gap.xs, alignItems: "flex-end" }}>
                  <Text variant="meta">Lean Mass</Text>
                  <Text variant="num" style={{ fontSize: 18, fontWeight: "700" as const }}>
                    {composition.leanMassKg.toFixed(1)} <Text variant="meta">KG</Text>
                  </Text>
                </View>
              </View>
            </TelemetryCell>
          )}
        </TelemetryGrid>
      </View>

      {/* Macro Targets */}
      {macroTargets.proteinG != null && (
        <View style={{ gap: gap.sm }}>
          <Text variant="meta">Macro Targets · Today</Text>
          <View style={{ flexDirection: "row", gap: gap.sm }}>
            <MacroProgressCell label="P" current={todayMacros.proteinG} target={macroTargets.proteinG} />
            <MacroProgressCell label="C" current={todayMacros.carbsG}   target={macroTargets.carbsG ?? 0} />
            <MacroProgressCell label="F" current={todayMacros.fatG}     target={macroTargets.fatG ?? 0} />
          </View>
        </View>
      )}

      {/* Weekly Calibration Trigger */}
      <Pressable onPress={() => router.push("/convergence")}>
        <View style={{
          borderWidth: hairline.width,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: gap.md,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          borderRadius: radius.card,
          shadowColor: colors.accent,
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        }}>
          <Text variant="meta">Weekly Calibration</Text>
          <Text variant="meta" color={colors.accent}>START →</Text>
        </View>
      </Pressable>

      {/* Today's Food Log */}
      <View style={{ gap: gap.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text variant="meta">Today · Food Log</Text>
          <Text variant="meta" color={colors.muted}>
            {todayMeals.length} {todayMeals.length === 1 ? "entry" : "entries"}
          </Text>
        </View>
        {todayMeals.length === 0 ? (
          <View style={{
            borderWidth: hairline.width, borderColor: colors.border,
            backgroundColor: colors.surface, padding: gap.md, borderRadius: radius.card,
          }}>
            <Text variant="body" color={colors.muted} style={{ fontSize: 12 }}>
              No fuel logged. Tap + below to search the catalog.
            </Text>
          </View>
        ) : (
          <View style={{
            borderWidth: hairline.width, borderColor: colors.border,
            backgroundColor: colors.surface, borderRadius: radius.card, overflow: "hidden",
          }}>
            {todayMeals.map((m, i) => {
              const protein = m.items.reduce((s, it) => s + (it.proteinG ?? 0), 0) || null;
              const carbs   = m.items.reduce((s, it) => s + (it.carbsG ?? 0), 0) || null;
              const fat     = m.items.reduce((s, it) => s + (it.fatG ?? 0), 0) || null;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => router.push({ pathname: "/edit-meal/[id]", params: { id: m.id } })}
                  onLongPress={() => void deleteMeal(m.id)}
                  style={({ pressed }) => ({
                    padding: gap.md,
                    borderTopWidth: i === 0 ? 0 : hairline.width,
                    borderTopColor: colors.border,
                    backgroundColor: pressed ? colors.accentSoft : "transparent",
                    gap: gap.sm,
                  })}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="meta" color={colors.accent}>{m.mealType.toUpperCase()}</Text>
                      <Text variant="body" numberOfLines={1}>
                        {m.items.map((it) => it.name).join(" + ")}
                      </Text>
                    </View>
                    <Text variant="num" style={{ fontSize: 18, fontWeight: "700" as const }}>
                      {m.totalKcal} <Text variant="meta">KCAL</Text>
                    </Text>
                  </View>
                  <MacroBar
                    proteinG={protein} carbsG={carbs} fatG={fat}
                    totalKcal={m.totalKcal} height={4} hideLabels
                  />
                </Pressable>
              );
            })}
          </View>
        )}
        {todayMeals.length > 0 && (
          <Text variant="meta" color={colors.muted} style={{ fontSize: 10 }}>
            Tap to edit · long-press to delete.
          </Text>
        )}
      </View>

      {/* Auxiliary navigation */}
      <View style={{ gap: gap.sm }}>
        <NavRow label="Recipes & Foods" onPress={() => router.push("/recipes")} tag="→" />
        <NavRow label="Settings & Data"  onPress={() => router.push("/settings")} tag="→" />
      </View>
    </Screen>
  );
}

const NavRow = ({ label, onPress, tag }: { label: string; onPress: () => void; tag: string }) => (
  <Pressable onPress={onPress}>
    <View style={{
      borderWidth: hairline.width, borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: gap.md,
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      borderRadius: radius.card,
      shadowColor: colors.accent,
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    }}>
      <Text variant="body" style={{ fontSize: 13 }}>{label}</Text>
      <Text variant="meta" color={colors.accent}>{tag}</Text>
    </View>
  </Pressable>
);

const MacroProgressCell = ({
  label, current, target,
}: { label: string; current: number; target: number }) => {
  const pct = target > 0 ? Math.min(current / target, 1.2) : 0;
  const over = current > target;
  return (
    <View style={{
      flex: 1,
      borderWidth: hairline.width,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: gap.md,
      gap: gap.xs,
      borderRadius: radius.card,
      shadowColor: colors.accent,
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    }}>
      <Text variant="meta">{label} · g</Text>
      <Text variant="num" style={{ fontSize: 18, fontWeight: "700" as const }}>
        {Math.round(current)}
      </Text>
      <Text variant="meta" color={over ? colors.accent : colors.muted}>/ {target}</Text>
      <View style={{ height: 4, backgroundColor: colors.fgSoft, marginTop: gap.xs, borderRadius: radius.pill }}>
        <View style={{
          width: `${Math.min(pct, 1) * 100}%`, height: "100%",
          backgroundColor: over ? colors.accent : colors.accent,
          borderRadius: radius.pill,
        }} />
      </View>
    </View>
  );
};

// Shared BottomNav imported from design library
