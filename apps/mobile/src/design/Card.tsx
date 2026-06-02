import { type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { colors, gap, hairline, radius } from "./tokens";

export interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  padding?: number;
}

/** Dense Matrix card: surface fill, hairline border, sharp radius. */
export const Card = ({ children, style, padding = gap.lg }: CardProps) => (
  <View
    style={[
      {
        backgroundColor: colors.surface,
        borderWidth: hairline.width,
        borderColor: hairline.color,
        borderRadius: radius.sharp,
        padding,
      },
      style,
    ]}
  >
    {children}
  </View>
);
