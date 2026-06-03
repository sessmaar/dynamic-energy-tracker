import { View } from "react-native";
import type { TrajectoryVerdict, TrendAnalysis } from "@dynamic-energy/engine";
import { colors, gap, hairline } from "./tokens";
import { Text } from "./Text";

/**
 * Bottom-line trajectory readout — the "what's happening" verdict the
 * user opens the app to see. Status, current rate ± CI, the noise
 * floor of their own scale, and (when goal + expected rate are
 * available) a one-line "actual vs expected" comparison.
 *
 * Color rules: the accent fires only when the verdict matches the
 * user's goal direction. Mismatches stay neutral so the screen isn't
 * yelling at the user for honest noise.
 */
export interface TrajectoryCardProps {
  verdict: TrajectoryVerdict;
  analysis: TrendAnalysis;
}

export const TrajectoryCard = ({ verdict, analysis }: TrajectoryCardProps) => {
  const accent = verdict.onTrack === true ||
    (verdict.status === "losing" && verdict.goalRatePerWeek != null && verdict.goalRatePerWeek < 0) ||
    (verdict.status === "gaining" && verdict.goalRatePerWeek != null && verdict.goalRatePerWeek > 0);

  const headlineColor = verdict.status === "inconclusive" ? colors.muted
    : accent ? colors.accent : colors.fg;

  const headline =
    verdict.status === "maintaining" ? "MAINTAINING"
    : verdict.status === "inconclusive" ? "INCONCLUSIVE"
    : verdict.status === "losing" ? "LOSING"
    : "GAINING";

  return (
    <View style={{
      borderWidth: hairline.width,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: gap.lg,
      gap: gap.md,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text variant="meta">Trajectory · {analysis.windowDays}-Day Regression</Text>
        <Text variant="meta" color={colors.muted}>{verdict.status === "inconclusive" ? "n.s." : "p < 0.05"}</Text>
      </View>

      <Text
        variant="num"
        color={headlineColor}
        style={{ fontSize: 36, fontWeight: "800" as const, letterSpacing: -1.5 }}
      >
        {headline}
      </Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View style={{ gap: 2 }}>
          <Text variant="meta">Rate</Text>
          <Text variant="num" style={{ fontSize: 22, fontWeight: "700" as const }}>
            {fmtRate(verdict.ratePerWeek)} <Text variant="meta">KG/WK</Text>
          </Text>
          <Text variant="meta" color={colors.muted}>
            95 % CI {fmtRate(verdict.ratePerWeekCI.lo)} … {fmtRate(verdict.ratePerWeekCI.hi)}
          </Text>
        </View>

        {(verdict.expectedRatePerWeek != null || verdict.goalRatePerWeek != null) && (
          <View style={{ gap: 2, alignItems: "flex-end" }}>
            {verdict.expectedRatePerWeek != null && (
              <>
                <Text variant="meta">Expected</Text>
                <Text variant="num" style={{ fontSize: 16 }}>
                  {fmtRate(verdict.expectedRatePerWeek)} <Text variant="meta">KG/WK</Text>
                </Text>
              </>
            )}
            {verdict.goalRatePerWeek != null && (
              <Text variant="meta" color={verdict.onTrack ? colors.accent : colors.muted}>
                target {fmtRate(verdict.goalRatePerWeek)}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={{ height: hairline.width, backgroundColor: colors.border }} />

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <Text variant="meta">Scale Noise Floor</Text>
          <Text variant="num">±{analysis.rawDailySDKg.toFixed(2)} kg/day</Text>
        </View>
        <View style={{ gap: 2, alignItems: "flex-end" }}>
          <Text variant="meta">Trend Residual</Text>
          <Text variant="num">±{analysis.residualSDKg.toFixed(2)} kg</Text>
        </View>
      </View>

      {analysis.transientWaterKg > 0.3 && (
        <View style={{
          marginTop: gap.xs, padding: gap.sm, backgroundColor: colors.accentSoft,
          borderRadius: 2, borderWidth: hairline.width, borderColor: colors.accent,
        }}>
          <Text variant="meta" color={colors.accent} style={{ fontSize: 10 }}>
            WATER FLUX · ~{analysis.transientWaterKg.toFixed(2)} KG transient mass detected from recent carbs
          </Text>
        </View>
      )}
    </View>
  );
};

const fmtRate = (n: number): string => {
  const abs = Math.abs(n).toFixed(2);
  return n < 0 ? `−${abs}` : `+${abs}`;
};
