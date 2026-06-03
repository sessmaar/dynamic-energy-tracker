import { type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { colors, gap, hairline, radius } from "./tokens";

export interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  padding?: number;
}

/** Navigator Light glass card: white surface, soft border, rounded corners, subtle blue shadow. */
export const Card = ({ children, style, padding = gap.lg }: CardProps) => (
  <View
    style={[
      {
        backgroundColor: colors.surface,
        borderWidth: hairline.width,
        borderColor: colors.border,
        borderRadius: radius.card,
        padding,
        shadowColor: colors.accent,
        shadowOpacity: 0.06,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      },
      style,
    ]}
  >
    {children}
  </View>
);
