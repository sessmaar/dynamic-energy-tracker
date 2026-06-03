import { type ReactNode } from "react";
import { Pressable, type ViewStyle } from "react-native";
import { colors, gap, radius } from "./tokens";
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
        backgroundColor: variant === "primary" ? colors.accent : colors.surfaceContainer,
        borderWidth: 1,
        borderColor: variant === "primary" ? colors.accent : colors.border,
        borderRadius: radius.card,
        paddingVertical: gap.md,
        paddingHorizontal: gap.lg,
        alignItems: "center",
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        shadowColor: variant === "primary" ? colors.accent : "transparent",
        shadowOpacity: pressed ? 0 : 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: variant === "primary" ? 2 : 0,
      },
      style,
    ]}
  >
    <Text
      variant="meta"
      color={variant === "primary" ? "#FFFFFF" : colors.fg}
      style={{ fontSize: 13, letterSpacing: 0.5, fontWeight: "600" }}
    >
      {children}
    </Text>
  </Pressable>
);
