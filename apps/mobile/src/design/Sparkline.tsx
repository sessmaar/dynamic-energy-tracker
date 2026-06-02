import { View } from "react-native";
import { colors } from "./tokens";

export interface SparklineProps {
  /** Normalized 0..1 bar heights. */
  values: readonly number[];
  /** Indices that should render in accent instead of fg-soft. */
  activeFrom?: number;
  height?: number;
  barGap?: number;
}

/** Bar-style sparkline matching `.sparkline` from `matrix-home.html`. */
export const Sparkline = ({
  values, activeFrom = values.length, height = 24, barGap = 2,
}: SparklineProps) => (
  <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap: barGap }}>
    {values.map((v, i) => (
      <View
        key={i}
        style={{
          flex: 1,
          height: `${Math.max(0, Math.min(1, v)) * 100}%`,
          backgroundColor: i >= activeFrom ? colors.accent : colors.fgSoft,
          borderRadius: 1,
        }}
      />
    ))}
  </View>
);
