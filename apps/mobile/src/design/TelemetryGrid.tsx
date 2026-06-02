import { type ReactNode } from "react";
import { View } from "react-native";
import { colors, gap, hairline } from "./tokens";

export interface TelemetryGridProps {
  children: ReactNode;
}

/**
 * 2-column grid where cell separation IS the border — same trick as
 * `.telemetry-grid` in the prototypes (gap: 1px on a border-colored
 * background). RN's `gap` works on `flex` containers but not nested
 * grids, so we render cells in a wrapping row with a hairline border
 * around the whole thing.
 */
export const TelemetryGrid = ({ children }: TelemetryGridProps) => (
  <View
    style={{
      flexDirection: "row",
      flexWrap: "wrap",
      backgroundColor: colors.border,
      gap: hairline.width,
      borderWidth: hairline.width,
      borderColor: hairline.color,
    }}
  >
    {children}
  </View>
);

export const TelemetryCell = ({
  children, span = 1,
}: { children: ReactNode; span?: 1 | 2 }) => (
  <View
    style={{
      flexBasis: span === 2 ? "100%" : `49.5%`,
      flexGrow: 1,
      backgroundColor: colors.bg,
      padding: gap.md,
      gap: gap.sm,
    }}
  >
    {children}
  </View>
);
