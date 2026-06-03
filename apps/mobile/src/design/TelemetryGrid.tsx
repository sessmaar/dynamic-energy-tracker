import { type ReactNode } from "react";
import { View } from "react-native";
import { colors, gap, hairline, radius } from "./tokens";

export interface TelemetryGridProps {
  children: ReactNode;
}

/**
 * 2-column grid. Navigator Light edition: white card surface, soft
 * border separator, rounded corners on the outer container.
 */
export const TelemetryGrid = ({ children }: TelemetryGridProps) => (
  <View
    style={{
      flexDirection: "row",
      flexWrap: "wrap",
      backgroundColor: colors.border,
      gap: hairline.width,
      borderWidth: hairline.width,
      borderColor: colors.border,
      borderRadius: radius.card,
      overflow: "hidden",
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
      backgroundColor: colors.surface,
      padding: gap.md,
      gap: gap.sm,
    }}
  >
    {children}
  </View>
);
