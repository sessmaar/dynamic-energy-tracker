import { type ReactNode } from "react";
import { Pressable, type ViewStyle } from "react-native";
import { colors, gap, hairline, radius } from "./tokens";
import { Text } from "./Text";

export interface ButtonProps {
  onPress: () => void;
  children: ReactNode;
  variant?: "primary" | "secondary";
  style?: ViewStyle;
  disabled?: boolean;
}

export const Button = ({
  onPress, children, variant = "primary", style, disabled,
}: ButtonProps) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      {
        backgroundColor: variant === "primary" ? colors.accent : colors.surface,
        borderWidth: hairline.width,
        borderColor: variant === "primary" ? colors.accent : colors.border,
        borderRadius: radius.card,
        paddingVertical: gap.md,
        paddingHorizontal: gap.lg,
        alignItems: "center",
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      },
      style,
    ]}
  >
    <Text
      variant="meta"
      color={variant === "primary" ? colors.bg : colors.fg}
      style={{ fontSize: 12, letterSpacing: 1.8 }}
    >
      {children}
    </Text>
  </Pressable>
);
