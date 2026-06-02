import { View } from "react-native";
import { colors } from "./tokens";

export interface RunwayProps {
  /** 0..1 — how much of today's intake has been logged. */
  fillFraction: number;
  /** 0..1 — where the target sits along the runway. Default 1.0. */
  targetFraction?: number;
  height?: number;
}

/**
 * Horizontal Energy Flux Runway. Soft fg-toned track, accent fill,
 * vertical target line glowing in accent. Mirrors `.runway-track` from
 * `screens/matrix-home.html`.
 */
export const Runway = ({ fillFraction, targetFraction = 1.0, height = 40 }: RunwayProps) => {
  const clampedFill = Math.max(0, Math.min(1, fillFraction));
  const clampedTarget = Math.max(0, Math.min(1, targetFraction));
  return (
    <View style={{ height, backgroundColor: colors.fgSoft, position: "relative" }}>
      <View
        style={{
          width: `${clampedFill * 100}%`,
          height: "100%",
          backgroundColor: colors.accent,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: -4,
          bottom: -4,
          left: `${clampedTarget * 100}%`,
          width: 2,
          backgroundColor: colors.fg,
          shadowColor: colors.accent,
          shadowOpacity: 0.8,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </View>
  );
};
